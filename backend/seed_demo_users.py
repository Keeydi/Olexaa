from main import DB_PATH, hash_password, init_db
import sqlite3


def seed_demo_users() -> None:
  """Insert a few demo users if they do not already exist."""

  init_db()

  users = [
      ("Demo Admin", "admin@example.com", "admin123"),
      ("Demo User", "user@example.com", "user1234"),
      ("FreshTrack Tester", "test@example.com", "test1234"),
  ]

  conn = sqlite3.connect(DB_PATH)
  try:
      cur = conn.cursor()
      for name, email, password in users:
          # Skip if email already exists
          cur.execute("SELECT id FROM users WHERE email = ?", (email.lower(),))
          existing = cur.fetchone()
          if existing:
              continue

          password_hash = hash_password(password)
          cur.execute(
              "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
              (name, email.lower(), password_hash),
          )
      conn.commit()
  finally:
      conn.close()


if __name__ == "__main__":
  seed_demo_users()
  print("Demo users seeded:")
  print("  admin@example.com / admin123")
  print("  user@example.com / user1234")
  print("  test@example.com / test1234")


