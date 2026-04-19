import requests
import sys
import json
from datetime import datetime

class GameActionTester:
    def __init__(self, base_url="https://deduction-game-3.preview.emergentagent.com"):
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
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                if data:
                    response = requests.post(url, json=data, headers=headers, params=params, timeout=10)
                else:
                    response = requests.post(url, headers=headers, params=params, timeout=10)

            print(f"   Status Code: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    print(f"   Response: {json.dumps(response_data, indent=2)}")
                    return True, response_data
                except:
                    return True, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error Response: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error Text: {response.text}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def setup_game_with_5_players(self):
        """Create a room and add 5 players, then start the game"""
        print("\n🎮 Setting up game with 5 players...")
        
        # Create room
        success, response = self.run_test(
            "Create Room for Game Test",
            "POST",
            "rooms",
            200
        )
        if not success:
            return False
        
        self.room_code = response['code']
        
        # Create 5 players and join them
        for i in range(5):
            player_name = f"Player{i+1}"
            
            # Create user
            success, user_response = self.run_test(
                f"Create User {player_name}",
                "POST",
                "auth/anonymous",
                200,
                params={"name": player_name}
            )
            if not success:
                return False
            
            user_id = user_response['userId']
            self.players.append((user_id, player_name))
            
            # Join room
            success, join_response = self.run_test(
                f"Join Room - {player_name}",
                "POST",
                f"rooms/{self.room_code}/join",
                200,
                params={"player_id": user_id, "player_name": player_name}
            )
            if not success:
                return False
        
        # Start the game
        success, start_response = self.run_test(
            "Start Game with 5 Players",
            "POST",
            f"rooms/{self.room_code}/start",
            200
        )
        
        return success

    def test_game_state_api(self):
        """Test the game state API"""
        if not self.room_code or not self.players:
            print("❌ Cannot test game state - no room or players")
            return False
        
        user_id, player_name = self.players[0]
        success, response = self.run_test(
            "Get Game State",
            "GET",
            f"rooms/{self.room_code}/game_state",
            200,
            params={"player_id": user_id}
        )
        
        if success:
            # Verify game state structure
            expected_fields = ['status', 'phase', 'regent_seat', 'tracks', 'players', 'your_role']
            for field in expected_fields:
                if field not in response:
                    print(f"❌ Missing field in game state: {field}")
                    return False
            
            print(f"✅ Game state has all required fields")
            print(f"   Phase: {response.get('phase')}")
            print(f"   Regent Seat: {response.get('regent_seat')}")
            print(f"   Your Role: {response.get('your_role')}")
            
        return success

    def test_nomination_action(self):
        """Test the nomination action"""
        if not self.room_code or not self.players:
            print("❌ Cannot test nomination - no room or players")
            return False
        
        # Get regent (should be player 1, seat 1)
        regent_id, regent_name = self.players[0]
        
        # Try to nominate player 2 (seat 2)
        success, response = self.run_test(
            "Nominate Player 2 as Chancellor",
            "POST",
            f"rooms/{self.room_code}/action",
            200,
            data={"nomineeSeat": 2},
            params={"player_id": regent_id, "action_type": "NOMINATE"}
        )
        
        return success

    def test_vote_action(self):
        """Test voting actions"""
        if not self.room_code or not self.players:
            print("❌ Cannot test voting - no room or players")
            return False
        
        # Have all players vote
        votes = ["oui", "oui", "non", "oui", "non"]  # 3 yes, 2 no - should pass
        
        for i, (user_id, player_name) in enumerate(self.players):
            vote = votes[i]
            success, response = self.run_test(
                f"Vote {vote.upper()} - {player_name}",
                "POST",
                f"rooms/{self.room_code}/action",
                200,
                data={"vote": vote},
                params={"player_id": user_id, "action_type": "VOTE"}
            )
            if not success:
                return False
        
        return True

    def test_invalid_actions(self):
        """Test invalid actions to ensure proper error handling"""
        if not self.room_code or not self.players:
            print("❌ Cannot test invalid actions - no room or players")
            return False
        
        user_id, player_name = self.players[0]
        
        # Test invalid action type
        success, response = self.run_test(
            "Invalid Action Type",
            "POST",
            f"rooms/{self.room_code}/action",
            400,
            data={},
            params={"player_id": user_id, "action_type": "INVALID_ACTION"}
        )
        
        return success

def main():
    print("🎮 Starting Secretus Regnum Game Action Tests")
    print("=" * 60)
    
    tester = GameActionTester()
    
    # Setup game
    if not tester.setup_game_with_5_players():
        print("❌ Failed to setup game - aborting tests")
        return 1
    
    # Run game action tests
    tests = [
        ("Game State API", tester.test_game_state_api),
        ("Nomination Action", tester.test_nomination_action),
        ("Vote Actions", tester.test_vote_action),
        ("Invalid Actions", tester.test_invalid_actions),
    ]
    
    for test_name, test_func in tests:
        print(f"\n{'='*20} {test_name} {'='*20}")
        try:
            test_func()
        except Exception as e:
            print(f"❌ Test {test_name} crashed: {str(e)}")
    
    # Print final results
    print(f"\n{'='*60}")
    print(f"📊 Final Results:")
    print(f"   Tests Run: {tester.tests_run}")
    print(f"   Tests Passed: {tester.tests_passed}")
    print(f"   Tests Failed: {tester.tests_run - tester.tests_passed}")
    print(f"   Success Rate: {(tester.tests_passed/tester.tests_run)*100:.1f}%" if tester.tests_run > 0 else "No tests run")
    
    if tester.room_code:
        print(f"\n🏰 Test Room: {tester.room_code}")
        print(f"👥 Players: {len(tester.players)}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())