-- Default admin: admin / admin123
-- Change it from the Settings page after first login.
INSERT OR IGNORE INTO admins (username, password_hash)
VALUES ('admin', 'pbkdf2$100000$K/icMwm8zgL8TZkbKo36fQ==$EA2Ffy1mWV634WiYexcZ13G6ALgmYjlip0Kj4QWIGnA=');
