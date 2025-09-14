import requests
import sys
import json
import time
from datetime import datetime

class MultiplayerFlowTester:
    def __init__(self, base_url="https://kingdom-betrayal-1.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.room_code = None
        self.players = []  # List of {user_id, name}

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name}")
        if details:
            print(f"   {details}")

    def create_anonymous_user(self, name):
        """Create an anonymous user and return user_id"""
        try:
            url = f"{self.api_url}/auth/anonymous"
            response = requests.post(url, params={"name": name}, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                user_id = data.get('userId')
                print(f"   Created user: {name} (ID: {user_id})")
                return user_id
            else:
                print(f"   Failed to create user {name}: {response.status_code}")
                return None
        except Exception as e:
            print(f"   Error creating user {name}: {str(e)}")
            return None

    def create_room(self):
        """Create a room and return room code"""
        try:
            url = f"{self.api_url}/rooms"
            response = requests.post(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                room_code = data.get('code')
                print(f"   Created room: {room_code}")
                return room_code
            else:
                print(f"   Failed to create room: {response.status_code}")
                return None
        except Exception as e:
            print(f"   Error creating room: {str(e)}")
            return None

    def join_room(self, room_code, user_id, player_name):
        """Join a room with given user"""
        try:
            url = f"{self.api_url}/rooms/{room_code}/join"
            params = {"player_id": user_id, "player_name": player_name}
            response = requests.post(url, params=params, timeout=10)
            
            if response.status_code == 200:
                print(f"   {player_name} joined room successfully")
                return True
            else:
                print(f"   {player_name} failed to join room: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error details: {error_data}")
                except:
                    print(f"   Error text: {response.text}")
                return False
        except Exception as e:
            print(f"   Error joining room for {player_name}: {str(e)}")
            return False

    def get_room_state(self, room_code):
        """Get current room state"""
        try:
            url = f"{self.api_url}/rooms/{room_code}"
            response = requests.get(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                return data
            else:
                print(f"   Failed to get room state: {response.status_code}")
                return None
        except Exception as e:
            print(f"   Error getting room state: {str(e)}")
            return None

    def start_game(self, room_code):
        """Start the game"""
        try:
            url = f"{self.api_url}/rooms/{room_code}/start"
            response = requests.post(url, timeout=10)
            
            if response.status_code == 200:
                data = response.json()
                print(f"   Game started successfully: {data}")
                return True
            else:
                print(f"   Failed to start game: {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error details: {error_data}")
                except:
                    print(f"   Error text: {response.text}")
                return False
        except Exception as e:
            print(f"   Error starting game: {str(e)}")
            return False

    def test_complete_multiplayer_flow(self):
        """Test the complete 5-player multiplayer flow"""
        print("\n🏰 TESTING COMPLETE MULTIPLAYER FLOW")
        print("=" * 60)
        
        # Step 1: Create room
        print("\n📝 Step 1: Creating room...")
        self.room_code = self.create_room()
        success = self.room_code is not None
        self.log_test("Create Room", success, f"Room code: {self.room_code}")
        
        if not success:
            return False

        # Step 2: Create 5 users and join room
        print("\n👥 Step 2: Creating 5 users and joining room...")
        player_names = ["Player1", "Player2", "Player3", "Player4", "Player5"]
        
        for i, name in enumerate(player_names, 1):
            print(f"\n   Creating and joining user {i}/5: {name}")
            
            # Create user
            user_id = self.create_anonymous_user(name)
            if not user_id:
                self.log_test(f"Create User {name}", False, "Failed to create user")
                return False
            
            # Join room
            join_success = self.join_room(self.room_code, user_id, name)
            if not join_success:
                self.log_test(f"Join Room - {name}", False, "Failed to join room")
                return False
            
            # Store player info
            self.players.append({"user_id": user_id, "name": name})
            
            # Check room state after each join
            room_state = self.get_room_state(self.room_code)
            if room_state:
                players_count = len(room_state.get('players', []))
                print(f"   Room now has {players_count} players")
                
                # Verify player is in the room
                player_found = any(p['name'] == name for p in room_state.get('players', []))
                if player_found:
                    self.log_test(f"Join Room - {name}", True, f"Player added successfully ({players_count}/5)")
                else:
                    self.log_test(f"Join Room - {name}", False, "Player not found in room state")
                    return False
            else:
                self.log_test(f"Get Room State after {name}", False, "Could not retrieve room state")
                return False

        # Step 3: Verify all 5 players are in room
        print("\n🔍 Step 3: Verifying all 5 players are properly in room...")
        final_room_state = self.get_room_state(self.room_code)
        
        if not final_room_state:
            self.log_test("Final Room State Check", False, "Could not get room state")
            return False
        
        players_in_room = final_room_state.get('players', [])
        players_count = len(players_in_room)
        
        print(f"   Final room state:")
        print(f"   - Room code: {final_room_state.get('code')}")
        print(f"   - Status: {final_room_state.get('status')}")
        print(f"   - Players count: {players_count}")
        
        for i, player in enumerate(players_in_room, 1):
            print(f"   - Player {i}: {player.get('name')} (ID: {player.get('id')}, Seat: {player.get('seat')}, Connected: {player.get('connected')})")
        
        # Verify exactly 5 players
        if players_count != 5:
            self.log_test("5 Players in Room", False, f"Expected 5 players, found {players_count}")
            return False
        
        # Verify all players are connected
        disconnected_players = [p for p in players_in_room if not p.get('connected', False)]
        if disconnected_players:
            self.log_test("All Players Connected", False, f"Found {len(disconnected_players)} disconnected players")
            return False
        
        self.log_test("5 Players in Room", True, "All 5 players properly added and connected")

        # Step 4: Start the game
        print("\n🎮 Step 4: Starting the game...")
        start_success = self.start_game(self.room_code)
        self.log_test("Start Game with 5 Players", start_success, "Game should start successfully")
        
        if not start_success:
            print("\n❌ CRITICAL: Game failed to start with 5 players!")
            print("   This is likely the root cause of the bug.")
            return False

        # Step 5: Verify game state after start
        print("\n✅ Step 5: Verifying game state after start...")
        post_start_state = self.get_room_state(self.room_code)
        
        if post_start_state:
            print(f"   Post-start status: {post_start_state.get('status')}")
            if post_start_state.get('status') == 'in_progress':
                self.log_test("Game Status After Start", True, "Game status is 'in_progress'")
            else:
                self.log_test("Game Status After Start", False, f"Expected 'in_progress', got '{post_start_state.get('status')}'")
        else:
            self.log_test("Get Game State After Start", False, "Could not get room state after start")

        return True

    def test_edge_cases(self):
        """Test edge cases that might cause the bug"""
        print("\n🔬 TESTING EDGE CASES")
        print("=" * 40)
        
        # Test starting game with insufficient players
        print("\n📝 Creating new room for edge case testing...")
        test_room = self.create_room()
        if not test_room:
            print("❌ Could not create test room for edge cases")
            return
        
        # Add only 4 players
        print("\n👥 Adding only 4 players...")
        for i in range(4):
            name = f"EdgePlayer{i+1}"
            user_id = self.create_anonymous_user(name)
            if user_id:
                self.join_room(test_room, user_id, name)
        
        # Try to start game (should fail)
        print("\n🎮 Trying to start game with 4 players (should fail)...")
        start_success = self.start_game(test_room)
        self.log_test("Start Game with 4 Players (Should Fail)", not start_success, "Game should NOT start with insufficient players")

def main():
    print("🏰 SECRETUS REGNUM MULTIPLAYER FLOW TEST")
    print("=" * 60)
    print(f"Testing against: https://kingdom-betrayal-1.preview.emergentagent.com")
    print(f"Started at: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = MultiplayerFlowTester()
    
    # Test the complete multiplayer flow
    flow_success = tester.test_complete_multiplayer_flow()
    
    # Test edge cases
    tester.test_edge_cases()
    
    # Print final results
    print(f"\n{'='*60}")
    print(f"📊 FINAL TEST RESULTS:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%" if tester.tests_run > 0 else "No tests run")
    
    if tester.room_code:
        print(f"\n🏰 Main Test Room: {tester.room_code}")
        print(f"👥 Players Created: {len(tester.players)}")
    
    # Summary
    print(f"\n{'='*60}")
    if flow_success:
        print("✅ MULTIPLAYER FLOW TEST PASSED")
        print("   The 5-player flow works correctly at the API level.")
        print("   If users are still experiencing issues, the problem is likely in the frontend.")
    else:
        print("❌ MULTIPLAYER FLOW TEST FAILED")
        print("   The backend has issues with the 5-player flow.")
        print("   This is likely the root cause of the reported bug.")
    
    return 0 if flow_success else 1

if __name__ == "__main__":
    sys.exit(main())