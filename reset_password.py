"""Reset a SOL account locally; place this file beside the project's package.json."""
import getpass
import hashlib
from pathlib import Path
import secrets
import sqlite3
import sys
import time
from datetime import datetime


def reset_password(db_path, email, password):
    if not isinstance(password, str) or not 12 <= len(password) <= 256:
        raise ValueError('Password must contain 12 to 256 characters.')
    email = email.strip().lower()
    path = Path(db_path).resolve()
    if not path.is_file():
        raise ValueError('Database not found. Put reset_password.py beside package.json in your original SOL project.')
    salt = secrets.token_hex(16)
    new_hash = salt + ':' + hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
    db = sqlite3.connect(path.as_uri() + '?mode=rw', uri=True, timeout=5)
    backup = None
    try:
        row = db.execute('SELECT id FROM users WHERE email=?', (email,)).fetchone()
        if row is None:
            raise ValueError('No account matches that email. Check the email and try again.')
        folder = path.parent / 'reset-backups'
        folder.mkdir(exist_ok=True)
        backup = folder / ('before-reset-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.sqlite3')
        with sqlite3.connect(backup) as target:
            db.backup(target)
        with db:
            db.execute('BEGIN IMMEDIATE')
            # Require the same account to still exist when the write lock is acquired.
            cursor = db.execute('UPDATE users SET password=? WHERE id=? AND email=?', (new_hash, row[0], email))
            if cursor.rowcount != 1:
                raise ValueError('Account changed. No password was updated; try again.')
            db.execute('DELETE FROM sessions WHERE user_id=?', (row[0],))
            db.execute('INSERT INTO audit(at,user_id,action,target) VALUES(?,?,?,?)',
                       (time.time(), row[0], 'local_password_reset', row[0]))
        return backup
    finally:
        db.close()


def main():
    print('SOL local password reset. Stop the backend with Ctrl+C in its terminal first.')
    db_path = Path(__file__).resolve().parent / 'server' / 'data' / 'sol.sqlite3'
    try:
        import tkinter as tk
        from tkinter import ttk, messagebox
        root = tk.Tk()
    except Exception:
       
        print('A graphical window is unavailable; using a single terminal password prompt.')
        email = input('Account email: ').strip()
        password = getpass.getpass('New password (12+ characters; hidden; enter ONCE): ')
        backup = reset_password(db_path, email, password)
        print('Password updated. Backup:', backup)
        print('Restart: py -3 server/server.py')
        return
    root.title('SOL - Reset password')
    root.geometry('500x360')
    root.resizable(False, False)
    frame = ttk.Frame(root, padding=24)
    frame.pack(fill='both', expand=True)
    ttk.Label(frame, text='Reset your SOL password', font=('Segoe UI', 17, 'bold')).pack(anchor='w')
    ttk.Label(frame, text='Stop the backend first. Records are preserved.').pack(anchor='w', pady=(6, 16))
    ttk.Label(frame, text='Account email').pack(anchor='w')
    email = tk.StringVar()
    email_entry = ttk.Entry(frame, textvariable=email, width=55)
    email_entry.pack(fill='x', pady=(4, 12))
    ttk.Label(frame, text='New password (12 to 256 characters)').pack(anchor='w')
    password = tk.StringVar()
    password_entry = ttk.Entry(frame, textvariable=password, show='*', width=55)
    password_entry.pack(fill='x', pady=(4, 8))
    visible = tk.BooleanVar(value=False)
    ttk.Checkbutton(frame, text='Show password', variable=visible,
                    command=lambda: password_entry.configure(show='' if visible.get() else '*')).pack(anchor='w')
    ttk.Label(frame, text='Enter your new password once. No second entry is required.').pack(anchor='w', pady=8)
    def submit():
        try:
            backup = reset_password(db_path, email.get(), password.get())
        except (ValueError, sqlite3.Error, OSError) as error:
            messagebox.showerror('Password was not changed', str(error), parent=root)
            return
        password.set('')
        print('Password updated. Local backup:', backup)
        print('Restart the backend: py -3 server/server.py')
        messagebox.showinfo('Password updated', 'Your new password is saved.\nRestart the backend and sign in.\nYour records are preserved.', parent=root)
        root.destroy()
    ttk.Button(frame, text='Save new password', command=submit).pack(anchor='w', pady=(8, 0))
    email_entry.focus_set()
    root.mainloop()

if __name__ == '__main__':
    try:
        main()
    except (ValueError, sqlite3.Error, OSError) as error:
        print('Reset failed:', error)
        sys.exit(1)
    except (KeyboardInterrupt, EOFError):
        print('\nCancelled.')
        sys.exit(1)
