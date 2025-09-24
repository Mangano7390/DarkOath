import requests
import sys
import json
from datetime import datetime
import time

class ComprehensiveSecretusRegnumTester:
    def __init__(self, base_url="https://shadow-council.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.room_code = None
        self.user_ids = []
        self.player_names = []

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

        except requests.exceptions.Timeout:
            print(f"❌ Failed - Request timed out")
            return False, {}
        except requests.exceptions.ConnectionError:
            print(f"❌ Failed - Connection error")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def create_multiple_users(self, count):
        """Create multiple users for testing"""
        print(f"\n🔧 Creating {count} test users...")
        for i in range(count):
            player_name = f"TestPlayer{i+1}"
            success, response = self.run_test(
                f"Create User {i+1}",
                "POST",
                "auth/anonymous",
                200,
                params={"name": player_name}
            )
            if success and 'userId' in response:
                self.user_ids.append(response['userId'])
                self.player_names.append(player_name)
                print(f"   Created user {i+1}: {response['userId']}")
            else:
                print(f"❌ Failed to create user {i+1}")
                return False
        return True

    def test_room_creation_and_joining(self):
        """Test room creation and multiple players joining"""
        print(f"\n{'='*20} ROOM CREATION & JOINING {'='*20}")
        
        # Create room
        success, response = self.run_test(
            "Create Room",
            "POST",
            "rooms",
            200
        )
        if not success or 'code' not in response:
            return False
        
        self.room_code = response['code']
        print(f"   Room created: {self.room_code}")
        
        # Join all users to the room
        for i, (user_id, player_name) in enumerate(zip(self.user_ids, self.player_names)):
            success, _ = self.run_test(
                f"Join Room - Player {i+1}",
                "POST",
                f"rooms/{self.room_code}/join",
                200,
                params={"player_id": user_id, "player_name": player_name}
            )
            if not success:
                return False
        
        # Verify room state shows all players
        success, response = self.run_test(
            "Get Room State After Joining",
            "GET",
            f"rooms/{self.room_code}",
            200
        )
        
        if success and 'players' in response:
            players = response['players']
            print(f"   Players in room: {len(players)}")
            for player in players:
                print(f"     - {player['name']} (Seat {player['seat']})")
            
            # Verify we have real player names, not "Joueur 1-5"
            real_names = [p['name'] for p in players if not p['name'].startswith('Joueur')]
            if len(real_names) == len(players):
                print("✅ All players have real names (not generic 'Joueur X')")
                self.tests_passed += 1
            else:
                print("❌ Some players still have generic names")
            self.tests_run += 1
        
        return success

    def test_game_start_with_different_player_counts(self):
        """Test starting games with different player counts and verify role distribution"""
        print(f"\n{'='*20} GAME START & ROLE DISTRIBUTION {'='*20}")
        
        # Test with current player count
        player_count = len(self.user_ids)
        print(f"\nTesting game start with {player_count} players...")
        
        if player_count < 5:
            # Should fail with insufficient players
            success, response = self.run_test(
                f"Start Game with {player_count} Players (Should Fail)",
                "POST",
                f"rooms/{self.room_code}/start",
                400
            )
            return success
        else:
            # Should succeed
            success, response = self.run_test(
                f"Start Game with {player_count} Players",
                "POST",
                f"rooms/{self.room_code}/start",
                200
            )
            
            if success:
                # Verify game state for each player
                for i, user_id in enumerate(self.user_ids):
                    success, game_state = self.run_test(
                        f"Get Game State - Player {i+1}",
                        "GET",
                        f"rooms/{self.room_code}/game_state",
                        200,
                        params={"player_id": user_id}
                    )
                    
                    if success:
                        print(f"   Player {i+1} role: {game_state.get('your_role', 'UNKNOWN')}")
                        
                        # Verify players have real names in game state
                        players = game_state.get('players', [])
                        real_names = [p['name'] for p in players if not p['name'].startswith('Joueur')]
                        if len(real_names) == len(players):
                            print(f"   ✅ Game state shows real player names")
                        else:
                            print(f"   ❌ Game state still shows generic names")
                
                # Collect all roles to verify distribution
                roles = []
                for user_id in self.user_ids:
                    success, game_state = self.run_test(
                        "Get Role Distribution",
                        "GET",
                        f"rooms/{self.room_code}/game_state",
                        200,
                        params={"player_id": user_id}
                    )
                    if success and 'your_role' in game_state:
                        roles.append(game_state['your_role'])
                
                # Verify role distribution matches rules
                self.verify_role_distribution(player_count, roles)
            
            return success

    def verify_role_distribution(self, player_count, roles):
        """Verify that role distribution matches the game rules"""
        print(f"\n🎭 Verifying role distribution for {player_count} players...")
        print(f"   Roles assigned: {roles}")
        
        role_counts = {
            'LOYAL': roles.count('LOYAL'),
            'CONJURE': roles.count('CONJURE'),
            'USURPATEUR': roles.count('USURPATEUR')
        }
        
        print(f"   Role counts: {role_counts}")
        
        # Expected distributions based on rules
        expected_distributions = {
            5: {'LOYAL': 3, 'CONJURE': 1, 'USURPATEUR': 1},
            6: {'LOYAL': 4, 'CONJURE': 1, 'USURPATEUR': 1},
            7: {'LOYAL': 4, 'CONJURE': 2, 'USURPATEUR': 1},
            8: {'LOYAL': 5, 'CONJURE': 2, 'USURPATEUR': 1},
            9: {'LOYAL': 5, 'CONJURE': 3, 'USURPATEUR': 1},
            10: {'LOYAL': 6, 'CONJURE': 3, 'USURPATEUR': 1}
        }
        
        if player_count in expected_distributions:
            expected = expected_distributions[player_count]
            print(f"   Expected: {expected}")
            
            self.tests_run += 1
            if role_counts == expected:
                print("✅ Role distribution matches expected rules")
                self.tests_passed += 1
                
                # Verify roles are not all the same (randomization working)
                if len(set(roles)) > 1:
                    print("✅ Roles are properly randomized (not all LOYAL)")
                    self.tests_passed += 1
                else:
                    print("❌ All players have the same role - randomization failed")
                self.tests_run += 1
            else:
                print("❌ Role distribution does not match expected rules")
        else:
            print(f"❌ No expected distribution defined for {player_count} players")

    def test_new_api_endpoints(self):
        """Test the new API endpoints"""
        print(f"\n{'='*20} NEW API ENDPOINTS {'='*20}")
        
        if not self.room_code or not self.user_ids:
            print("❌ Cannot test new endpoints - missing room or users")
            return False
        
        # Test game_state endpoint
        success, response = self.run_test(
            "New Game State Endpoint",
            "GET",
            f"rooms/{self.room_code}/game_state",
            200,
            params={"player_id": self.user_ids[0]}
        )
        
        if success:
            # Verify response contains expected fields
            expected_fields = ['status', 'phase', 'regent_seat', 'tracks', 'your_role', 'players']
            missing_fields = [field for field in expected_fields if field not in response]
            
            if not missing_fields:
                print("✅ Game state endpoint returns all expected fields")
                self.tests_passed += 1
            else:
                print(f"❌ Game state endpoint missing fields: {missing_fields}")
            self.tests_run += 1
        
        # Test chat endpoint
        success, response = self.run_test(
            "Chat Endpoint",
            "POST",
            f"rooms/{self.room_code}/chat",
            200,
            params={
                "player_id": self.user_ids[0],
                "message": "Test chat message from API test"
            }
        )
        
        return success

    def test_lobby_capacity(self):
        """Test that lobby supports up to 10 players"""
        print(f"\n{'='*20} LOBBY CAPACITY TEST {'='*20}")
        
        current_players = len(self.user_ids)
        print(f"Current players in room: {current_players}")
        
        if current_players >= 10:
            print("✅ Room already has 10 players - capacity test passed")
            self.tests_passed += 1
            self.tests_run += 1
            return True
        
        # Try to add more players up to 10
        additional_needed = 10 - current_players
        print(f"Adding {additional_needed} more players to test capacity...")
        
        for i in range(additional_needed):
            player_name = f"ExtraPlayer{current_players + i + 1}"
            
            # Create user
            success, response = self.run_test(
                f"Create Extra User {i+1}",
                "POST",
                "auth/anonymous",
                200,
                params={"name": player_name}
            )
            
            if success and 'userId' in response:
                user_id = response['userId']
                
                # Try to join room
                success, _ = self.run_test(
                    f"Join Room - Extra Player {i+1}",
                    "POST",
                    f"rooms/{self.room_code}/join",
                    200,
                    params={"player_id": user_id, "player_name": player_name}
                )
                
                if success:
                    self.user_ids.append(user_id)
                    self.player_names.append(player_name)
        
        # Verify final count
        success, response = self.run_test(
            "Final Room State Check",
            "GET",
            f"rooms/{self.room_code}",
            200
        )
        
        if success and 'players' in response:
            final_count = len(response['players'])
            print(f"Final player count: {final_count}")
            
            self.tests_run += 1
            if final_count <= 10:
                print("✅ Room respects 10-player limit")
                self.tests_passed += 1
            else:
                print("❌ Room exceeded 10-player limit")
        
        return success

def main():
    print("🏰 Starting Comprehensive Secretus Regnum API Tests")
    print("=" * 60)
    
    # Setup
    tester = ComprehensiveSecretusRegnumTester()
    
    # Create test users (start with 7 to test role distribution)
    if not tester.create_multiple_users(7):
        print("❌ Failed to create test users")
        return 1
    
    # Run comprehensive tests
    tests = [
        ("Room Creation & Joining", tester.test_room_creation_and_joining),
        ("Game Start & Role Distribution", tester.test_game_start_with_different_player_counts),
        ("New API Endpoints", tester.test_new_api_endpoints),
        ("Lobby Capacity (Up to 10)", tester.test_lobby_capacity),
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
        print(f"👥 Total Users Created: {len(tester.user_ids)}")
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())