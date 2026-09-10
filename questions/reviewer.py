#!/usr/bin/env python3
"""
Question Reviewer
------------------
Reads questions.json (schema: {"questions": [...]}) and lets you review
each question one at a time.

  - Reject  -> removes the question from questions.json permanently.
  - Accept  -> writes the (optionally edited) question to
               questions_clean.json and removes it from questions.json.

Progress is never lost: every accept/reject rewrites questions.json on
disk immediately, and the id of the last question you looked at is
stored in questions.json itself under "last_id" (also refreshed on
close). Next time you run the script it just picks up wherever
questions.json currently stands.

Run it from the folder that contains questions.json:
    python3 question_reviewer.py
"""

import json
import os
import shutil
import tempfile
import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext

QUESTIONS_PATH = "questions.json"
CLEAN_PATH = "questions_clean.json"


def atomic_write_json(path: str, data: dict) -> None:
    """Write JSON to disk without risking a half-written file on crash."""
    directory = os.path.dirname(os.path.abspath(path)) or "."
    fd, tmp_path = tempfile.mkstemp(dir=directory, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        shutil.move(tmp_path, path)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise


def load_json(path: str, default: dict) -> dict:
    if not os.path.exists(path):
        return default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


class ReviewerApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Question Reviewer")
        self.geometry("1100x760")
        self.minsize(900, 650)

        if not os.path.exists(QUESTIONS_PATH):
            messagebox.showerror(
                "questions.json not found",
                f"Could not find {QUESTIONS_PATH} in the current folder.\n"
                "Place it next to this script and restart.",
            )
            self.destroy()
            return

        self.data = load_json(QUESTIONS_PATH, {"questions": []})
        self.data.setdefault("questions", [])
        self.clean_data = load_json(CLEAN_PATH, {"questions": []})
        self.clean_data.setdefault("questions", [])

        self.protocol("WM_DELETE_WINDOW", self.on_close)
        self._build_ui()
        self.refresh()

    # ------------------------------------------------------------------ UI
    def _build_ui(self):
        container = ttk.Frame(self, padding=12)
        container.pack(fill="both", expand=True)
        container.columnconfigure(0, weight=1)
        container.columnconfigure(1, weight=1)
        container.rowconfigure(1, weight=3)
        container.rowconfigure(2, weight=1)

        self.progress_var = tk.StringVar()
        ttk.Label(
            container, textvariable=self.progress_var, font=("", 11, "bold")
        ).grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 8))

        # ---- Left: original question (read-only) ----
        left = ttk.LabelFrame(container, text="Original", padding=10)
        left.grid(row=1, column=0, sticky="nsew", padx=(0, 8))
        left.columnconfigure(0, weight=1)
        left.rowconfigure(1, weight=1)

        self.meta_var = tk.StringVar()
        ttk.Label(left, textvariable=self.meta_var, font=("", 10, "italic")).grid(
            row=0, column=0, sticky="w", pady=(0, 6)
        )

        ttk.Label(left, text="Question:").grid(row=1, column=0, sticky="nw")
        self.q_display = scrolledtext.ScrolledText(
            left, height=6, wrap="word", state="disabled"
        )
        self.q_display.grid(row=2, column=0, sticky="nsew", pady=(0, 8))
        left.rowconfigure(2, weight=1)

        ttk.Label(left, text="Answer:").grid(row=3, column=0, sticky="w")
        self.a_display_var = tk.StringVar()
        ttk.Entry(left, textvariable=self.a_display_var, state="readonly").grid(
            row=4, column=0, sticky="ew", pady=(0, 8)
        )

        ttk.Label(left, text="Alternatives:").grid(row=5, column=0, sticky="w")
        self.alt_display_var = tk.StringVar()
        ttk.Entry(left, textvariable=self.alt_display_var, state="readonly").grid(
            row=6, column=0, sticky="ew", pady=(0, 12)
        )

        btn_row = ttk.Frame(left)
        btn_row.grid(row=7, column=0, sticky="ew")
        btn_row.columnconfigure(0, weight=1)
        btn_row.columnconfigure(1, weight=1)
        ttk.Button(btn_row, text="Reject", command=self.on_reject).grid(
            row=0, column=0, sticky="ew", padx=(0, 4)
        )
        ttk.Button(btn_row, text="Accept", command=self.on_accept).grid(
            row=0, column=1, sticky="ew", padx=(4, 0)
        )

        # ---- Right: editable fields used on Accept ----
        right = ttk.LabelFrame(container, text="Edit before accepting", padding=10)
        right.grid(row=1, column=1, sticky="nsew", padx=(8, 0))
        right.columnconfigure(0, weight=1)
        right.rowconfigure(1, weight=1)

        ttk.Label(right, text="Question:").grid(row=0, column=0, sticky="w")
        self.q_edit = scrolledtext.ScrolledText(right, height=6, wrap="word")
        self.q_edit.grid(row=1, column=0, sticky="nsew", pady=(0, 8))
        right.rowconfigure(1, weight=1)

        ttk.Label(right, text="Answer:").grid(row=2, column=0, sticky="w")
        self.a_edit = ttk.Entry(right)
        self.a_edit.grid(row=3, column=0, sticky="ew", pady=(0, 8))

        ttk.Label(right, text="Alternatives (comma separated):").grid(
            row=4, column=0, sticky="w"
        )
        self.alt_edit = ttk.Entry(right)
        self.alt_edit.grid(row=5, column=0, sticky="ew")

        # ---- Bottom: add a brand new question straight into the clean file ----
        add_frame = ttk.LabelFrame(container, text="Add New Question", padding=10)
        add_frame.grid(row=2, column=0, columnspan=2, sticky="nsew", pady=(12, 0))
        for c in range(4):
            add_frame.columnconfigure(c, weight=1)

        ttk.Label(add_frame, text="Category:").grid(row=0, column=0, sticky="w")
        self.new_category = ttk.Entry(add_frame)
        self.new_category.grid(row=1, column=0, sticky="ew", padx=(0, 6))

        ttk.Label(add_frame, text="Question:").grid(row=0, column=1, sticky="w")
        self.new_question = ttk.Entry(add_frame)
        self.new_question.grid(row=1, column=1, sticky="ew", padx=6)

        ttk.Label(add_frame, text="Answer:").grid(row=0, column=2, sticky="w")
        self.new_answer = ttk.Entry(add_frame)
        self.new_answer.grid(row=1, column=2, sticky="ew", padx=6)

        ttk.Label(add_frame, text="Alternatives (comma separated):").grid(
            row=0, column=3, sticky="w"
        )
        self.new_alternatives = ttk.Entry(add_frame)
        self.new_alternatives.grid(row=1, column=3, sticky="ew", padx=(6, 0))

        ttk.Button(add_frame, text="Add Question", command=self.on_add_new).grid(
            row=2, column=0, columnspan=4, sticky="ew", pady=(8, 0)
        )

        # keyboard shortcuts
        self.bind("<Control-Return>", lambda e: self.on_accept())
        self.bind("<Escape>", lambda e: self.on_reject())

    # --------------------------------------------------------------- logic
    def current(self):
        qs = self.data["questions"]
        return qs[0] if qs else None

    def refresh(self):
        item = self.current()
        remaining = len(self.data["questions"])

        if item is None:
            self.progress_var.set("All questions reviewed. 0 remaining.")
            self.meta_var.set("")
            self._set_text(self.q_display, "", disabled=True)
            self.a_display_var.set("")
            self.alt_display_var.set("")
            self._set_text(self.q_edit, "")
            self.a_edit.delete(0, "end")
            self.alt_edit.delete(0, "end")
            for child in self.winfo_children():
                pass
            return

        self.progress_var.set(f"{remaining} question(s) remaining")
        self.meta_var.set(f"ID: {item.get('id')}   Category: {item.get('category', '')}")

        self._set_text(self.q_display, item.get("question", ""), disabled=True)
        self.a_display_var.set(item.get("answer", ""))
        self.alt_display_var.set(", ".join(item.get("alternatives", []) or []))

        self._set_text(self.q_edit, item.get("question", ""))
        self.a_edit.delete(0, "end")
        self.a_edit.insert(0, item.get("answer", ""))
        self.alt_edit.delete(0, "end")
        self.alt_edit.insert(0, ", ".join(item.get("alternatives", []) or []))

    @staticmethod
    def _set_text(widget, text, disabled=False):
        widget.configure(state="normal")
        widget.delete("1.0", "end")
        widget.insert("1.0", text)
        if disabled:
            widget.configure(state="disabled")

    def _pop_and_save(self, item):
        """Remove the given item from questions.json and persist to disk."""
        self.data["questions"].pop(0)
        self.data["last_id"] = item.get("id")
        atomic_write_json(QUESTIONS_PATH, self.data)

    def on_reject(self):
        item = self.current()
        if item is None:
            return
        self._pop_and_save(item)
        self.refresh()

    def on_accept(self):
        item = self.current()
        if item is None:
            return

        question_text = self.q_edit.get("1.0", "end").strip()
        answer_text = self.a_edit.get().strip()
        alt_raw = self.alt_edit.get().strip()
        alternatives = [a.strip() for a in alt_raw.split(",") if a.strip()]

        if not question_text or not answer_text:
            messagebox.showwarning(
                "Missing data", "Question and answer can't be empty."
            )
            return

        cleaned_item = {
            "id": len(self.clean_data["questions"]) + 1,
            "category": item.get("category", ""),
            "question": question_text,
            "answer": answer_text,
            "alternatives": alternatives,
        }
        self.clean_data["questions"].append(cleaned_item)
        atomic_write_json(CLEAN_PATH, self.clean_data)

        self._pop_and_save(item)
        self.refresh()

    def on_add_new(self):
        question_text = self.new_question.get().strip()
        answer_text = self.new_answer.get().strip()
        category_text = self.new_category.get().strip()
        alt_raw = self.new_alternatives.get().strip()
        alternatives = [a.strip() for a in alt_raw.split(",") if a.strip()]

        if not question_text or not answer_text:
            messagebox.showwarning(
                "Missing data", "Question and answer can't be empty."
            )
            return

        new_item = {
            "id": len(self.clean_data["questions"]) + 1,
            "category": category_text,
            "question": question_text,
            "answer": answer_text,
            "alternatives": alternatives,
        }

        self.clean_data["questions"].append(new_item)
        atomic_write_json(CLEAN_PATH, self.clean_data)

        for widget in (
            self.new_category,
            self.new_question,
            self.new_answer,
            self.new_alternatives,
        ):
            widget.delete(0, "end")
        self.new_category.focus_set()

    def on_close(self):
        # Record the last question looked at, even if no action was taken.
        item = self.current()
        if item is not None:
            self.data["last_id"] = item.get("id")
            atomic_write_json(QUESTIONS_PATH, self.data)
        self.destroy()


if __name__ == "__main__":
    app = ReviewerApp()
    app.mainloop()