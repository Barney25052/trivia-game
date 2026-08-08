import requests


url = "https://opentdb.com/api.php?amount=10&category=9&difficulty=hard&type=multiple"

response = requests.get(
    url
)

if response.status_code == 200:
    data = response.json()
    print(data)
else:
    print("Error:", response.status_code)