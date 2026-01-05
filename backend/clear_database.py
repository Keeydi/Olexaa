from main import DB_PATH, init_db
import sqlite3


def clear_database() -> None:
    """Clear all pantry items and waste events from the database."""
    
    init_db()  # Ensure tables exist
    
    conn = sqlite3.connect(DB_PATH)
    try:
        cur = conn.cursor()
        
        # Clear pantry items
        cur.execute("DELETE FROM pantry_items")
        pantry_count = cur.rowcount
        
        # Clear waste events
        cur.execute("DELETE FROM waste_events")
        waste_count = cur.rowcount
        
        conn.commit()
        
        print(f"Database cleared successfully!")
        print(f"  - Removed {pantry_count} pantry item(s)")
        print(f"  - Removed {waste_count} waste event(s)")
        print(f"  - Users table preserved (accounts kept)")
        
    finally:
        conn.close()


if __name__ == "__main__":
    clear_database()




