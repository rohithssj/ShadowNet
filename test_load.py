import json

with open("devices.json", "r") as file:
    devices = json.load(file)

print("Total devices loaded:", len(devices))
print("First device sample:")
print(devices[0])