import requests
import json

def test_chat_after_fix():
    """Quick test to verify chat still works after removing duplicate endpoint"""
    base_url = "https://secretus-regnum.preview.emergentagent.com"
    api_url = f"{base_url}/api"
    
    print("🔧 Testing Chat System After Duplicate Endpoint Fix")
    print("=" * 55)
    
    # Create a test room and player
    try:
        # Create room
        response = requests.post(f"{api_url}/rooms", timeout=10)
        if response.status_code != 200:
            print("❌ Failed to create room")
            return False
        room_code = response.json()['code']
        print(f"✅ Created room: {room_code}")
        
        # Create player
        response = requests.post(f"{api_url}/auth/anonymous", params={"name": "TestUser"}, timeout=10)
        if response.status_code != 200:
            print("❌ Failed to create user")
            return False
        user_id = response.json()['userId']
        print(f"✅ Created user: {user_id}")
        
        # Join room
        response = requests.post(f"{api_url}/rooms/{room_code}/join", 
                               params={"player_id": user_id, "player_name": "TestUser"}, timeout=10)
        if response.status_code != 200:
            print("❌ Failed to join room")
            return False
        print("✅ Joined room successfully")
        
        # Send chat message
        response = requests.post(f"{api_url}/rooms/{room_code}/chat", 
                               params={"player_id": user_id, "message": "Test après correction du bug!"}, timeout=10)
        if response.status_code != 200:
            print(f"❌ Failed to send chat message: {response.status_code}")
            print(f"   Response: {response.text}")
            return False
        print("✅ Chat message sent successfully")
        
        # Get chat history
        response = requests.get(f"{api_url}/rooms/{room_code}/chat", 
                              params={"player_id": user_id}, timeout=10)
        if response.status_code != 200:
            print(f"❌ Failed to get chat history: {response.status_code}")
            return False
        print("✅ Chat history retrieved successfully")
        
        print(f"\n🎉 All tests passed! Chat system is working correctly.")
        print(f"🏰 Test room: {room_code}")
        return True
        
    except Exception as e:
        print(f"❌ Test failed with error: {str(e)}")
        return False

if __name__ == "__main__":
    test_chat_after_fix()