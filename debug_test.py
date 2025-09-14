import requests
import json

# Test with the room from previous test
room_code = "YWGTCJ"
base_url = "https://throne-scheme.preview.emergentagent.com/api"

# Create a test user to check game state
response = requests.post(f"{base_url}/auth/anonymous", params={"name": "DebugUser"})
if response.status_code == 200:
    user_id = response.json()["userId"]
    print(f"Created debug user: {user_id}")
    
    # Try to join the room to see current state
    join_response = requests.post(f"{base_url}/rooms/{room_code}/join", 
                                 params={"player_id": user_id, "player_name": "DebugUser"})
    print(f"Join response: {join_response.status_code}")
    
    # Get game state
    state_response = requests.get(f"{base_url}/rooms/{room_code}/game_state", 
                                 params={"player_id": user_id})
    if state_response.status_code == 200:
        state = state_response.json()
        print(f"Current phase: {state.get('phase')}")
        print(f"Regent seat: {state.get('regent_seat')}")
        print(f"Nominee seat: {state.get('nominee_seat')}")
        print(f"Legislative cards visible to debug user: {state.get('legislative_cards', [])}")
        print(f"Players: {[p['name'] + ' (seat ' + str(p['seat']) + ')' for p in state.get('players', [])]}")
    else:
        print(f"Failed to get game state: {state_response.status_code}")
        print(state_response.text)
else:
    print(f"Failed to create user: {response.status_code}")