import requests
import sys
import json
import time
from datetime import datetime

class MultiplayerAPITester:
    def __init__(self, base_url="https://throne-scheme.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.room_code = None
        self.players = []  # List of (user_id, name) tuples

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                if data:
                    response = requests.post(url, json=data, headers=headers, params=params, timeout=10)
                else:
                    response = requests.post(url, headers=headers, params=params, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error Text: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def create_user_and_room(self):
        """Create first user and room"""
        print("\n🏰 Creating room and first player...")
        
        # Create first user
        success, response = self.run_test(
            "Create First User",
            "POST",
            "auth/anonymous",
            200,
            params={"name": "Player1"}
        )
        if not success:
            return False
        
        user_id = response['userId']
        self.players.append((user_id, "Player1"))
        
        # Create room
        success, response = self.run_test(
            "Create Room",
            "POST",
            "rooms",
            200
        )
        if not success:
            return False
            
        self.room_code = response['code']
        print(f"   Room Code: {self.room_code}")
        
        # Join room with first player
        success, _ = self.run_test(
            "First Player Join Room",
            "POST",
            f"rooms/{self.room_code}/join",
            200,
            params={"player_id": user_id, "player_name": "Player1"}
        )
        
        return success

    def add_players(self, count=4):
        """Add additional players to reach 5 total"""
        print(f"\n👥 Adding {count} more players...")
        
        for i in range(2, count + 2):  # Player2 to Player5
            player_name = f"Player{i}"
            
            # Create user
            success, response = self.run_test(
                f"Create {player_name}",
                "POST",
                "auth/anonymous",
                200,
                params={"name": player_name}
            )
            if not success:
                return False
            
            user_id = response['userId']
            self.players.append((user_id, player_name))
            
            # Join room
            success, _ = self.run_test(
                f"{player_name} Join Room",
                "POST",
                f"rooms/{self.room_code}/join",
                200,
                params={"player_id": user_id, "player_name": player_name}
            )
            if not success:
                return False
                
            # Check room state after each player joins
            success, response = self.run_test(
                f"Check Room State After {player_name}",
                "GET",
                f"rooms/{self.room_code}",
                200
            )
            if success:
                player_count = len(response.get('players', []))
                print(f"   Players in room: {player_count}/5")
        
        return True

    def test_room_state_with_5_players(self):
        """Test room state with all 5 players"""
        print("\n🎯 Testing room state with 5 players...")
        
        success, response = self.run_test(
            "Get Room State (5 Players)",
            "GET",
            f"rooms/{self.room_code}",
            200
        )
        
        if success:
            players = response.get('players', [])
            print(f"   Total players: {len(players)}")
            print(f"   Room status: {response.get('status')}")
            
            for player in players:
                print(f"   - {player['name']} (Seat {player['seat']}, Connected: {player['connected']})")
            
            return len(players) == 5
        
        return False

    def test_start_game_with_5_players(self):
        """Test starting game with 5 players"""
        print("\n🚀 Testing game start with 5 players...")
        
        success, response = self.run_test(
            "Start Game (5 Players)",
            "POST",
            f"rooms/{self.room_code}/start",
            200
        )
        
        if success:
            print("   Game started successfully!")
            
            # Check room state after game start
            success, response = self.run_test(
                "Check Room State After Game Start",
                "GET",
                f"rooms/{self.room_code}",
                200
            )
            
            if success:
                print(f"   Room status after start: {response.get('status')}")
                return response.get('status') == 'in_progress'
        
        return success

def main():
    print("🏰 Starting Secretus Regnum Multiplayer API Tests")
    print("=" * 60)
    
    tester = MultiplayerAPITester()
    
    # Test sequence
    print("\n📋 Test Sequence:")
    print("1. Create room and first player")
    print("2. Add 4 more players (total 5)")
    print("3. Verify room state with 5 players")
    print("4. Start game with 5 players")
    
    # Step 1: Create room and first player
    if not tester.create_user_and_room():
        print("❌ Failed to create room and first player")
        return 1
    
    # Step 2: Add 4 more players
    if not tester.add_players(4):
        print("❌ Failed to add additional players")
        return 1
    
    # Step 3: Verify room state
    if not tester.test_room_state_with_5_players():
        print("❌ Room state verification failed")
        return 1
    
    # Step 4: Start game
    if not tester.test_start_game_with_5_players():
        print("❌ Game start failed")
        return 1
    
    # Final results
    print(f"\n{'='*60}")
    print(f"📊 Final Results:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%" if tester.tests_run > 0 else "No tests run")
    
    print(f"\n🏰 Test Room: {tester.room_code}")
    print(f"👥 Players Created: {len(tester.players)}")
    for i, (user_id, name) in enumerate(tester.players):
        print(f"   {i+1}. {name} ({user_id[:8]}...)")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())