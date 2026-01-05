from typing import List
from contextlib import asynccontextmanager

import os
import sqlite3
from contextlib import contextmanager
import hashlib
import binascii
import secrets
from datetime import datetime, timedelta

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

try:
    import google.generativeai as genai
except ImportError:
    genai = None

try:
    import cv2
    import numpy as np
    from PIL import Image
    import io
    CV_AVAILABLE = True
except ImportError:
    CV_AVAILABLE = False


GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "pantry.db")


def init_db() -> None:
    """Initialize the SQLite database and tables if they don't exist."""
    os.makedirs(BASE_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    try:
        # Pantry items table
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS pantry_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                quantity TEXT,
                expiry_date TEXT,
                emoji TEXT,
                status TEXT,
                value REAL,
                category TEXT
            )
            """
        )

        # Users table for real auth
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL
            )
            """
        )

        # Waste events table for statistics
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS waste_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                item_name TEXT,
                status TEXT,
                deleted_at TEXT NOT NULL,
                value REAL,
                category TEXT
            )
            """
        )

        # Basic migration: ensure newer columns exist in older DBs
        try:
            conn.execute("ALTER TABLE pantry_items ADD COLUMN value REAL")
        except sqlite3.OperationalError:
            pass

        try:
            conn.execute("ALTER TABLE pantry_items ADD COLUMN category TEXT")
        except sqlite3.OperationalError:
            pass

        try:
            conn.execute("ALTER TABLE waste_events ADD COLUMN value REAL")
        except sqlite3.OperationalError:
            pass

        try:
            conn.execute("ALTER TABLE waste_events ADD COLUMN category TEXT")
        except sqlite3.OperationalError:
            pass

        conn.commit()
    finally:
        conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown."""
    # Startup
    init_db()
    yield
    # Shutdown (if needed)


app = FastAPI(
    title="FreshTrack AI Backend",
    version="0.3.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PantryItem(BaseModel):
    """
    Shared pantry item shape for AI and DB.
    """

    name: str
    quantity: str | None = None
    expiry_date: str | None = None
    emoji: str | None = None
    status: str | None = None
    # Estimated monetary value of this item (for savings tracking)
    value: float | None = None
    # Category for organizing items (Fruits, Vegetables, Dairy, Meat, etc.)
    category: str | None = None


class PantryItemIn(PantryItem):
    """Payload when creating/updating items in the DB."""

    pass


class PantryItemOut(PantryItem):
    """Pantry item as stored in SQLite (includes ID)."""

    id: int


class RecipeRequest(BaseModel):
    pantry_items: List[PantryItem]


class Recipe(BaseModel):
    id: str
    title: str
    ingredients: List[str]
    instructions: str


class RecipeResponse(BaseModel):
    recipes: List[Recipe]


class UserBase(BaseModel):
    name: str
    email: str


class UserCreate(UserBase):
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class UserOut(UserBase):
    id: int


class WastePoint(BaseModel):
    label: str
    value: int


class WasteSummary(BaseModel):
    total: str
    delta: str
    # Monetary stats (in whatever currency the client uses)
    saved_value: float
    wasted_value: float
    saved_value_formatted: str
    wasted_value_formatted: str


class CategoryWaste(BaseModel):
    category: str
    wasted_count: int
    saved_count: int
    wasted_value: float
    saved_value: float


class EnhancedWasteStatsResponse(BaseModel):
    trend: List[WastePoint]
    summary: WasteSummary
    category_breakdown: List[CategoryWaste]


class WasteStatsResponse(BaseModel):
    trend: List[WastePoint]
    summary: WasteSummary


@contextmanager
def get_db():
    """Context manager that yields a SQLite connection with Row factory enabled."""

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def hash_password(password: str) -> str:
    """Hash a password with a random salt using SHA-256."""

    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return binascii.hexlify(salt).decode("ascii") + ":" + binascii.hexlify(dk).decode("ascii")


def verify_password(password: str, stored_hash: str) -> bool:
    """Verify a password against the stored salt:hash string."""

    try:
        salt_hex, hash_hex = stored_hash.split(":", 1)
        salt = binascii.unhexlify(salt_hex)
        expected_hash = binascii.unhexlify(hash_hex)
    except Exception:
        return False

    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return secrets.compare_digest(dk, expected_hash)


def calculate_expiry_status(expiry_date_str: str | None) -> str:
    """
    Calculate the expiry status based on the expiry date.
    Returns: 'fresh', 'expiring', or 'expired'
    """
    if not expiry_date_str:
        return 'fresh'  # Default if no date provided
    
    try:
        # Try parsing various date formats
        expiry_date = None
        
        # Try ISO format first
        try:
            expiry_date = datetime.fromisoformat(expiry_date_str.replace('Z', '+00:00'))
        except:
            pass
        
        # Try common formats like "Nov 30, 2025" or "30/11/2025"
        if expiry_date is None:
            try:
                expiry_date = datetime.strptime(expiry_date_str, "%b %d, %Y")
            except:
                try:
                    expiry_date = datetime.strptime(expiry_date_str, "%d/%m/%Y")
                except:
                    try:
                        expiry_date = datetime.strptime(expiry_date_str, "%m/%d/%Y")
                    except:
                        pass
        
        if expiry_date is None:
            return 'fresh'  # Default if parsing fails
        
        # Normalize to date only (remove time)
        expiry_date = expiry_date.date()
        today = datetime.utcnow().date()
        
        # Calculate days until expiry
        days_until_expiry = (expiry_date - today).days
        
        if days_until_expiry < 0:
            return 'expired'
        elif days_until_expiry <= 3:  # Expiring within 3 days
            return 'expiring'
        else:
            return 'fresh'
            
    except Exception:
        return 'fresh'  # Default on any error


def get_gemini_model():
    if genai is None:
        raise RuntimeError("google-generativeai is not installed")
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set in environment")

    genai.configure(api_key=GEMINI_API_KEY)
    # Use Gemini 2.5 Flash as requested.
    # If this model is not available on the current account, the /ai/recipes
    # endpoint will gracefully fall back to local recipe generation.
    return genai.GenerativeModel("gemini-2.5-flash")


def generate_local_recipes(pantry_items: list[PantryItem]) -> RecipeResponse:
    """
    Fallback recipe generator that does NOT call Gemini.
    This is used when GEMINI_API_KEY is missing or Gemini is unavailable,
    so the app still behaves nicely for demos.
    """

    # Simple heuristic: pick a few item names and build recipes around them.
    names = [item.name for item in pantry_items if item.name]
    unique_names = list(dict.fromkeys(names))  # preserve order, remove duplicates

    if not unique_names:
        unique_names = ["Pantry Mix"]

    base_ingredients = [n.lower() for n in unique_names[:5]]

    recipes: list[Recipe] = []

    if base_ingredients:
        main = base_ingredients[0]
        recipes.append(
            Recipe(
                id="local-1",
                title=f"Easy {main.title()} Bowl",
                ingredients=[*unique_names[:3], "olive oil", "salt", "pepper"],
                instructions=(
                    f"Chop your {', '.join(unique_names[:3])}. "
                    "Sauté in a pan with olive oil, salt, and pepper until tender. "
                    "Serve warm as a simple bowl or side dish."
                ),
            )
        )

    if len(base_ingredients) >= 2:
        main, second = base_ingredients[0], base_ingredients[1]
        recipes.append(
            Recipe(
                id="local-2",
                title=f"{main.title()} & {second.title()} Skillet",
                ingredients=[*unique_names[:4], "garlic", "onion"],
                instructions=(
                    f"Slice {unique_names[0]} and {unique_names[1]} thinly. "
                    "Cook with garlic and onion in a skillet until fragrant. "
                    "Add remaining veggies, season to taste, and cook until done."
                ),
            )
        )

    if len(base_ingredients) >= 3:
        recipes.append(
            Recipe(
                id="local-3",
                title="Pantry Sheet-Pan Roast",
                ingredients=[*unique_names[:5], "olive oil", "mixed herbs"],
                instructions=(
                    "Preheat oven to 200°C. Cut all veggies into similar-sized pieces. "
                    "Toss with olive oil, salt, pepper, and mixed herbs. "
                    "Roast on a tray for 20–30 minutes until golden and cooked through."
                ),
            )
        )

    if not recipes:
        recipes.append(
            Recipe(
                id="local-fallback",
                title="Simple Pantry Stir-Fry",
                ingredients=["Any vegetables you have", "oil", "soy sauce or salt"],
                instructions=(
                    "Slice whatever vegetables you have. Stir-fry in a hot pan with oil, "
                    "season with soy sauce or salt and pepper, and serve with rice or bread."
                ),
            )
        )

    return RecipeResponse(recipes=recipes)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/auth/signup", response_model=UserOut, status_code=201)
async def signup(user: UserCreate):
    """Create a new user account with hashed password."""

    with get_db() as conn:
        cur = conn.execute("SELECT id FROM users WHERE email = ?", (user.email.lower(),))
        existing = cur.fetchone()
        if existing:
            raise HTTPException(status_code=400, detail="Email is already registered")

        password_hash = hash_password(user.password)

        cur = conn.execute(
            """
            INSERT INTO users (name, email, password_hash)
            VALUES (?, ?, ?)
            """,
            (user.name.strip(), user.email.lower().strip(), password_hash),
        )
        conn.commit()
        user_id = cur.lastrowid

        cur = conn.execute(
            "SELECT id, name, email FROM users WHERE id = ?",
            (user_id,),
        )
        row = cur.fetchone()

    if row is None:
        raise HTTPException(status_code=500, detail="Failed to create user")

    return UserOut(id=row["id"], name=row["name"], email=row["email"])


@app.post("/auth/login", response_model=UserOut)
async def login(credentials: UserLogin):
    """Verify user credentials and return user info if valid."""

    with get_db() as conn:
        cur = conn.execute(
            "SELECT id, name, email, password_hash FROM users WHERE email = ?",
            (credentials.email.lower(),),
        )
        row = cur.fetchone()

    if row is None or not verify_password(credentials.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return UserOut(id=row["id"], name=row["name"], email=row["email"])


@app.get("/pantry/items", response_model=List[PantryItemOut])
async def list_pantry_items():
    """Return all pantry items stored in SQLite with automatically calculated expiry status."""

    with get_db() as conn:
        cur = conn.execute(
            "SELECT id, name, quantity, expiry_date, emoji, status, value, category "
            "FROM pantry_items ORDER BY expiry_date ASC, name ASC"
        )
        rows = cur.fetchall()

        items = []
        updates_needed = []
        
        for row in rows:
            # Calculate status based on expiry_date if not already set or needs update
            calculated_status = calculate_expiry_status(row["expiry_date"])
            # Use calculated status (always recalculate to ensure accuracy)
            status = calculated_status
            
            # Track if update is needed
            if row["status"] != calculated_status:
                updates_needed.append((calculated_status, row["id"]))
            
            items.append(
                PantryItemOut(
                    id=row["id"],
                    name=row["name"],
                    quantity=row["quantity"],
                    expiry_date=row["expiry_date"],
                    emoji=row["emoji"],
                    status=status,
                    value=row["value"],
                    category=row["category"],
                )
            )
        
        # Update statuses if needed (all within the same connection context)
        if updates_needed:
            for calculated_status, item_id in updates_needed:
                conn.execute(
                    "UPDATE pantry_items SET status = ? WHERE id = ?",
                    (calculated_status, item_id)
                )
            conn.commit()
    
    return items


@app.post("/pantry/items", response_model=PantryItemOut, status_code=201)
async def create_pantry_item(item: PantryItemIn):
    """Create a new pantry item in SQLite with automatically calculated expiry status."""

    # Calculate status based on expiry_date
    calculated_status = calculate_expiry_status(item.expiry_date)
    # Use calculated status instead of provided status
    final_status = calculated_status

    with get_db() as conn:
        cur = conn.execute(
            """
            INSERT INTO pantry_items (name, quantity, expiry_date, emoji, status, value, category)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item.name,
                item.quantity,
                item.expiry_date,
                item.emoji,
                final_status,
                item.value,
                item.category,
            ),
        )
        conn.commit()
        item_id = cur.lastrowid

        cur = conn.execute(
            "SELECT id, name, quantity, expiry_date, emoji, status, value, category "
            "FROM pantry_items WHERE id = ?",
            (item_id,),
        )
        row = cur.fetchone()

    if row is None:
        raise HTTPException(status_code=500, detail="Failed to create pantry item")

    return PantryItemOut(
        id=row["id"],
        name=row["name"],
        quantity=row["quantity"],
        expiry_date=row["expiry_date"],
        emoji=row["emoji"],
        status=row["status"],
        value=row["value"],
        category=row["category"],
    )


@app.delete("/pantry/items/{item_id}", status_code=204)
async def delete_pantry_item(item_id: int):
    """Delete a pantry item by ID and record a waste event."""

    with get_db() as conn:
        # Fetch item details first so we can log a waste event
        cur = conn.execute(
            "SELECT name, status, value, category FROM pantry_items WHERE id = ?",
            (item_id,),
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Pantry item not found")

        conn.execute("DELETE FROM pantry_items WHERE id = ?", (item_id,))

        # Record a waste/savings event for statistics.
        deleted_at = datetime.utcnow().isoformat(timespec="seconds")

        # Heuristic:
        # - If the item was still fresh/expiring when removed, treat as "eaten" (saved).
        # - If it was expired (or unknown), treat as "spoiled" (wasted).
        original_status = (row["status"] or "").lower() if row["status"] is not None else ""
        if original_status in ("fresh", "expiring"):
            outcome_status = "eaten"
        else:
            outcome_status = "spoiled"

        value = row["value"] if "value" in row.keys() else None
        category = row["category"] if "category" in row.keys() else None

        conn.execute(
            """
            INSERT INTO waste_events (item_name, status, deleted_at, value, category)
            VALUES (?, ?, ?, ?, ?)
            """,
            (row["name"], outcome_status, deleted_at, value, category),
        )

        conn.commit()

    # 204 No Content – nothing to return
    return None


@app.get("/stats/waste", response_model=WasteStatsResponse)
async def get_waste_stats():
    """Legacy endpoint - returns basic waste stats."""
    enhanced = await get_enhanced_waste_stats()
    return WasteStatsResponse(trend=enhanced.trend, summary=enhanced.summary)


@app.get("/stats/waste/enhanced", response_model=EnhancedWasteStatsResponse)
async def get_enhanced_waste_stats():
    """
    Return simple waste statistics based on recorded waste events.

    - trend: last 7 days (including today), each with a label and item count
    - summary.total: total number of waste events ever ("N items")
    - summary.delta: percentage change between the last 7 days and the previous 7 days
    """

    today = datetime.utcnow().date()
    start_date = today - timedelta(days=13)  # 14 days window (7 current + 7 previous)

    with get_db() as conn:
        # Per-day counts for trend
        cur = conn.execute(
            """
            SELECT DATE(deleted_at) AS d, COUNT(*) AS c
            FROM waste_events
            WHERE DATE(deleted_at) >= ?
            GROUP BY DATE(deleted_at)
            """,
            (start_date.isoformat(),),
        )
        rows = cur.fetchall()

        # Total number of waste/savings events
        cur_total = conn.execute("SELECT COUNT(*) FROM waste_events")
        total_events = cur_total.fetchone()[0]

        # Monetary totals
        cur_value = conn.execute(
            """
            SELECT
              COALESCE(SUM(CASE WHEN status = 'eaten' THEN value END), 0.0) AS saved_value,
              COALESCE(SUM(CASE WHEN status != 'eaten' THEN value END), 0.0) AS wasted_value
            FROM waste_events
            """
        )
        row_val = cur_value.fetchone()
        saved_value = float(row_val[0] or 0.0)
        wasted_value = float(row_val[1] or 0.0)

    # Map date string -> count
    counts_by_date: dict[str, int] = {
        row["d"]: row["c"] for row in rows if row["d"] is not None
    }

    # Build last 7 days trend
    trend: list[WastePoint] = []
    last_7_dates: list[datetime.date] = []
    prev_7_dates: list[datetime.date] = []

    for i in range(13, -1, -1):
        day = today - timedelta(days=i)
        if i <= 6:
            last_7_dates.append(day)
        else:
            prev_7_dates.append(day)

    for day in last_7_dates:
        day_str = day.isoformat()
        count = counts_by_date.get(day_str, 0)
        label = day.strftime("%a")  # Mon, Tue, ...
        trend.append(WastePoint(label=label, value=count))

    # Compute delta between last 7 days and previous 7 days
    def sum_for(days: list[datetime.date]) -> int:
        return sum(counts_by_date.get(d.isoformat(), 0) for d in days)

    last_7_total = sum_for(last_7_dates)
    prev_7_total = sum_for(prev_7_dates)

    if prev_7_total == 0:
        if last_7_total == 0:
            delta_pct = "0%"
        else:
            delta_pct = "100%"
    else:
        change = (last_7_total - prev_7_total) / prev_7_total * 100
        delta_pct = f"{change:+.0f}%"

    # Simple currency formatting (no symbol to keep it locale-agnostic)
    def fmt_currency(amount: float) -> str:
        return f"{amount:,.2f}"

    summary = WasteSummary(
        total=f"{total_events} item" + ("s" if total_events != 1 else ""),
        delta=delta_pct,
        saved_value=saved_value,
        wasted_value=wasted_value,
        saved_value_formatted=fmt_currency(saved_value),
        wasted_value_formatted=fmt_currency(wasted_value),
    )

    # Category breakdown
    try:
        cur_category = conn.execute(
            """
            SELECT 
              COALESCE(category, 'Uncategorized') AS cat,
              SUM(CASE WHEN status = 'eaten' THEN 1 ELSE 0 END) AS saved_count,
              SUM(CASE WHEN status != 'eaten' THEN 1 ELSE 0 END) AS wasted_count,
              SUM(CASE WHEN status = 'eaten' THEN COALESCE(value, 0) ELSE 0 END) AS saved_val,
              SUM(CASE WHEN status != 'eaten' THEN COALESCE(value, 0) ELSE 0 END) AS wasted_val
            FROM waste_events
            GROUP BY cat
            ORDER BY wasted_count DESC
            """
        )
        category_rows = cur_category.fetchall()
        
        category_breakdown = [
            CategoryWaste(
                category=row["cat"] or "Uncategorized",
                saved_count=row["saved_count"] or 0,
                wasted_count=row["wasted_count"] or 0,
                saved_value=float(row["saved_val"] or 0.0),
                wasted_value=float(row["wasted_val"] or 0.0),
            )
            for row in category_rows
        ]
    except Exception as e:
        print(f"Error getting category breakdown: {e}")
        category_breakdown = []

    return EnhancedWasteStatsResponse(
        trend=trend,
        summary=summary,
        category_breakdown=category_breakdown,
    )


@app.post("/ai/recipes", response_model=RecipeResponse)
async def ai_recipes(payload: RecipeRequest):
    """
    Generate recipe recommendations based on pantry items using Gemini.
    """
    if not payload.pantry_items:
        raise HTTPException(status_code=400, detail="pantry_items cannot be empty")

    # If Gemini is not configured, fall back to local recipe generation
    if genai is None or not GEMINI_API_KEY:
        return generate_local_recipes(payload.pantry_items)

    try:
        model = get_gemini_model()
    except RuntimeError as e:
        # As an extra safety, fall back to local generation if Gemini fails
        return generate_local_recipes(payload.pantry_items)

    items_text = "\n".join(
        f"- {item.name}"
        + (f" (qty: {item.quantity})" if item.quantity else "")
        + (f", expiring: {item.expiry_date}" if item.expiry_date else "")
        for item in payload.pantry_items
    )

    prompt = f"""
You are an assistant for a food-waste tracking app called FreshTrack.
The user has the following pantry items:
{items_text}

Using only these ingredients (plus simple staples like oil, salt, pepper, common spices),
propose 3 concise recipe ideas that help them use up items that are expiring soon.

Return the result as strict JSON with this shape:
{{
  "recipes": [
    {{
      "id": "string-unique-id",
      "title": "Recipe name",
      "ingredients": ["list", "of", "ingredient names"],
      "instructions": "Short paragraph with clear steps."
    }}
  ]
}}
Do NOT include any extra text outside of the JSON. Do not use backticks.
"""

    try:
        response = model.generate_content(prompt)
        text = response.text.strip()
    except Exception as e:
        # If Gemini fails for any reason (model not found, quota, network, etc.),
        # log the error and fall back to local recipe generation instead of
        # surfacing a 502 to the frontend. This keeps the Recipes screen usable
        # even when AI is misconfigured or temporarily unavailable.
        print(f"Gemini error in /ai/recipes, falling back to local recipes: {e}")
        return generate_local_recipes(payload.pantry_items)

    import json

    try:
        data = json.loads(text)

        # Basic structural validation
        if "recipes" not in data or not isinstance(data["recipes"], list):
            raise ValueError("Gemini response missing 'recipes' list")

        recipes: list[Recipe] = []
        for idx, r in enumerate(data["recipes"]):
            try:
                recipe = Recipe(
                    id=str(r.get("id") or f"ai-{idx+1}"),
                    title=r.get("title") or "Untitled recipe",
                    ingredients=r.get("ingredients") or [],
                    instructions=r.get("instructions") or "",
                )
                recipes.append(recipe)
            except Exception:
                # Skip malformed entries but keep trying others
                continue

        if not recipes:
            raise ValueError("No valid recipes generated from Gemini response")

        return RecipeResponse(recipes=recipes)

    except Exception as e:
        # Any parsing/validation issue from Gemini should not break the app;
        # log and fall back to local recipe generation instead of returning 502.
        print(f"Gemini parse/validation error in /ai/recipes, falling back to local recipes: {e}")
        return generate_local_recipes(payload.pantry_items)


class FreshnessResponse(BaseModel):
    """Response model for freshness analysis."""
    freshness_score: float  # 0.0 to 100.0
    freshness_label: str  # "Very Fresh", "Fresh", "Expiring Soon", "Spoiled"
    confidence: float  # 0.0 to 1.0
    analysis_details: dict


class FoodRecognitionResponse(BaseModel):
    """Response model for food item recognition."""
    name: str  # Recognized food name
    confidence: float  # 0.0 to 1.0
    suggestions: List[str]  # Alternative suggestions
    estimated_expiry_days: int | None  # Estimated days until expiry based on food type


def analyze_freshness(image_bytes: bytes) -> FreshnessResponse:
    """
    Analyze food freshness from an image using OpenCV and basic computer vision.
    
    This uses heuristics based on:
    - Color saturation (fresh food tends to be more vibrant)
    - Texture variance (spoiled food may have discoloration/spots)
    - Overall brightness and contrast
    
    Returns a freshness score (0-100) and label.
    """
    if not CV_AVAILABLE:
        # Fallback if OpenCV is not installed
        return FreshnessResponse(
            freshness_score=75.0,
            freshness_label="Fresh",
            confidence=0.5,
            analysis_details={"error": "OpenCV not available, using default estimate"}
        )
    
    try:
        # Load image from bytes
        image = Image.open(io.BytesIO(image_bytes))
        # Convert to RGB if needed
        if image.mode != 'RGB':
            image = image.convert('RGB')
        # Convert PIL to numpy array
        img_array = np.array(image)
        # Convert RGB to BGR for OpenCV
        img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
        
        # Convert to HSV for better color analysis
        hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)
        
        # Extract color channels
        h, s, v = cv2.split(hsv)
        
        # Calculate metrics
        # 1. Average saturation (higher = more vibrant/fresh)
        avg_saturation = np.mean(s)
        saturation_score = min(avg_saturation / 128.0, 1.0) * 40  # Max 40 points
        
        # 2. Variance in saturation (low variance might indicate uniform discoloration)
        saturation_variance = np.var(s)
        variance_score = min(saturation_variance / 5000.0, 1.0) * 20  # Max 20 points
        
        # 3. Average brightness (very dark might indicate spoilage)
        avg_brightness = np.mean(v)
        brightness_score = min(avg_brightness / 200.0, 1.0) * 20  # Max 20 points
        
        # 4. Edge detection for texture (more edges = more texture = likely fresher)
        gray = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
        edges = cv2.Canny(gray, 50, 150)
        edge_density = np.sum(edges > 0) / (edges.shape[0] * edges.shape[1])
        texture_score = min(edge_density * 10, 1.0) * 20  # Max 20 points
        
        # Combine scores (0-100)
        freshness_score = saturation_score + variance_score + brightness_score + texture_score
        freshness_score = max(0.0, min(100.0, freshness_score))
        
        # Determine label
        if freshness_score >= 75:
            freshness_label = "Very Fresh"
            confidence = 0.8
        elif freshness_score >= 50:
            freshness_label = "Fresh"
            confidence = 0.7
        elif freshness_score >= 25:
            freshness_label = "Expiring Soon"
            confidence = 0.6
        else:
            freshness_label = "Spoiled"
            confidence = 0.7
        
        analysis_details = {
            "saturation_score": round(saturation_score, 2),
            "variance_score": round(variance_score, 2),
            "brightness_score": round(brightness_score, 2),
            "texture_score": round(texture_score, 2),
            "avg_saturation": round(float(avg_saturation), 2),
            "avg_brightness": round(float(avg_brightness), 2),
        }
        
        return FreshnessResponse(
            freshness_score=round(freshness_score, 1),
            freshness_label=freshness_label,
            confidence=round(confidence, 2),
            analysis_details=analysis_details
        )
        
    except Exception as e:
        # If analysis fails, return a conservative estimate
        print(f"Error analyzing freshness: {e}")
        return FreshnessResponse(
            freshness_score=50.0,
            freshness_label="Fresh",
            confidence=0.3,
            analysis_details={"error": str(e)}
        )


@app.post("/ai/freshness", response_model=FreshnessResponse)
async def analyze_food_freshness(file: UploadFile = File(...)):
    """
    Analyze food freshness from an uploaded image.
    
    Accepts an image file and returns a freshness score (0-100),
    label, and confidence level.
    """
    if not CV_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="Image analysis not available. Please install opencv-python and numpy."
        )
    
    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read image bytes
        image_bytes = await file.read()
        
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        # Analyze freshness
        result = analyze_freshness(image_bytes)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to analyze image: {str(e)}")


def recognize_food_item(image_bytes: bytes) -> FoodRecognitionResponse:
    """
    Recognize food item from an image using Gemini AI.
    This replaces barcode scanning by using AI to identify food items.
    """
    if genai is None or not GEMINI_API_KEY:
        # Fallback: return generic response
        return FoodRecognitionResponse(
            name="Food Item",
            confidence=0.3,
            suggestions=["Vegetable", "Fruit", "Dairy", "Meat", "Grain"],
            estimated_expiry_days=None
        )
    
    try:
        model = get_gemini_model()
        
        # Convert image bytes to base64 for Gemini
        import base64
        image_base64 = base64.b64encode(image_bytes).decode('utf-8')
        
        prompt = """
        Look at this image of a food item and identify what it is.
        Return ONLY a JSON object with this exact structure:
        {
          "name": "exact food name (e.g., 'Tomato', 'Milk', 'Banana')",
          "confidence": 0.0-1.0,
          "suggestions": ["alternative name 1", "alternative name 2"],
          "estimated_expiry_days": number of days this food typically lasts (or null if unknown)
        }
        
        Be specific with the name. Use common food names. Do not include any other text.
        """
        
        # Use Gemini's vision capabilities
        response = model.generate_content([
            prompt,
            {
                "mime_type": "image/jpeg",
                "data": image_base64
            }
        ])
        
        import json
        text = response.text.strip()
        
        # Try to extract JSON from response
        # Remove markdown code blocks if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        text = text.strip()
        
        data = json.loads(text)
        
        return FoodRecognitionResponse(
            name=data.get("name", "Food Item"),
            confidence=float(data.get("confidence", 0.5)),
            suggestions=data.get("suggestions", []),
            estimated_expiry_days=data.get("estimated_expiry_days")
        )
        
    except Exception as e:
        print(f"Error recognizing food item: {e}")
        # Fallback response
        return FoodRecognitionResponse(
            name="Food Item",
            confidence=0.3,
            suggestions=[],
            estimated_expiry_days=None
        )


@app.post("/ai/recognize", response_model=FoodRecognitionResponse)
async def recognize_food(file: UploadFile = File(...)):
    """
    Recognize food item from an uploaded image using AI.
    This replaces barcode scanning by identifying food items from photos.
    
    Returns the recognized food name, confidence, suggestions, and estimated expiry days.
    """
    # Validate file type
    if not file.content_type or not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="File must be an image")
    
    try:
        # Read image bytes
        image_bytes = await file.read()
        
        if len(image_bytes) == 0:
            raise HTTPException(status_code=400, detail="Empty image file")
        
        # Recognize food item
        result = recognize_food_item(image_bytes)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to recognize food item: {str(e)}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)

