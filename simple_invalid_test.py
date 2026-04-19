import requests
import json

def test_invalid_actions():
    base_url = "https://deduction-game-3.preview.emergentagent.com/api"
    
    # Create room and players
    room_response = requests.post(f"{base_url}/rooms")
    room_code = room_response.json()["code"]
    print(f"Created room: {room_code}")
    
    players = []
    for i, name in enumerate(["Alice", "Bob", "Charlie", "Diana", "Eve"]):
        user_response = requests.post(f"{base_url}/auth/anonymous", params={"name": name})
        user_id = user_response.json()["userId"]
        requests.post(f"{base_url}/rooms/{room_code}/join", params={"player_id": user_id, "player_name": name})
        players.append({"id": user_id, "name": name, "seat": i + 1})
    
    # Start game
    requests.post(f"{base_url}/rooms/{room_code}/start")
    
    # Get regent and nominate
    regent_id = players[0]["id"]  # Alice (seat 1)
    requests.post(f"{base_url}/rooms/{room_code}/action", 
                 params={"player_id": regent_id, "action_type": "NOMINATE"},
                 json={"nomineeSeat": 2})
    
    # Vote to reach LEGIS_REGENT
    for player in players[2:]:  # Charlie, Diana, Eve vote
        requests.post(f"{base_url}/rooms/{room_code}/action",
                     params={"player_id": player["id"], "action_type": "VOTE"},
                     json={"vote": "oui"})
    
    print("Reached LEGIS_REGENT phase")
    
    # Test 1: Non-regent tries to discard
    non_regent_id = players[1]["id"]  # Bob
    response = requests.post(f"{base_url}/rooms/{room_code}/action",
                           params={"player_id": non_regent_id, "action_type": "DISCARD"},
                           json={"cardId": 0})
    
    if response.status_code == 400:
        print("✅ Non-regent discard correctly blocked")
    else:
        print(f"❌ Non-regent discard should be blocked, got {response.status_code}")
    
    # Test 2: Invalid card index
    response = requests.post(f"{base_url}/rooms/{room_code}/action",
                           params={"player_id": regent_id, "action_type": "DISCARD"},
                           json={"cardId": 99})
    
    if response.status_code == 400:
        print("✅ Invalid card index correctly blocked")
    else:
        print(f"❌ Invalid card index should be blocked, got {response.status_code}")
    
    print("Invalid actions test completed")

if __name__ == "__main__":
    test_invalid_actions()