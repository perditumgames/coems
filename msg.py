# adding stuff
import tkinter as tk
from tkinter import messagebox
import requests
import io

# sending the text??? i think yeah
def send_post_request():
    url = "https://frrny.perditum.com/writeToPng"  # Replace this with your remote server URL
    text_data = {
        "text": text_entry.get()  # Get the text from the entry field
    }

    try:
        response = requests.post(url, json=text_data)
        response.raise_for_status()  # Check for any error in the response

    except requests.exceptions.RequestException as e:
        messagebox.showerror("Error", f"Failed to send POST request: {e}")

# on the sixth day, god created the return class
def on_enter(event):
    send_post_request()

# and on the seventh day, god created the window
root = tk.Tk()
root.title("PROPERTY OF FRRNY AND NATSUKI - DO NOT DISTRIBUTE")
root.geometry("500x200")

# text thing
text_label = tk.Label(root, text="Enter Text:")
text_label.pack()
text_entry = tk.Entry(root)
text_entry.pack()
testnt_label = tk.Label(root, text="PROPERTY OF FRRNY AND NATSUKI - DO NOT DISTRIBUTE")
testnt_label.pack()

# train wreck
text_entry.bind("<Return>", on_enter)

# send thing
send_button = tk.Button(root, text="Send Request", command=send_post_request)
send_button.pack()

# why does this exist just run the code like c++
root.mainloop()