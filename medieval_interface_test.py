#!/usr/bin/env python3
"""
Medieval Interface Test Setup
Creates a test room with 5 players for testing the new medieval interface
"""

import requests
import sys
import json
from datetime import datetime
import time

class MedievalInterfaceTestSetup:
    def __init__(self, base_url="https://secretus-regnum.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.room_code = None
        self.user_ids = []
        self.player_names = ["Alice", "Bob", "Charlie", "Diana", "Eve"]  # Real medieval-style names
        self.tests_run = 0
        self.tests_passed = 0

    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
            if details:
                print(f"   {details}")
        else:
            print(f"❌ {name}")
            if details:
                print(f"   {details}")

    def make_request(self, method, endpoint, expected_status=200, data=None, params=None):
        """Make API request with error handling"""
        url = f"{self.api_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
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
                try:
                    return True, response.json()
                except:
                    return True, {}
            else:
                try:
                    error_data = response.json()
                    return False, error_data
                except:
                    return False, {"error": response.text, "status": response.status_code}
                    
        except requests.exceptions.Timeout:
            return False, {"error": "Request timed out"}
        except requests.exceptions.ConnectionError:
            return False, {"error": "Connection error"}
        except Exception as e:
            return False, {"error": str(e)}

    def create_players(self):
        """Create 5 anonymous players with medieval names"""
        print("\n🏰 Creating 5 players for medieval interface testing...")
        
        for i, name in enumerate(self.player_names):
            success, response = self.make_request(
                "POST", 
                "auth/anonymous", 
                200, 
                params={"name": name}
            )
            
            if success and 'userId' in response:
                self.user_ids.append(response['userId'])
                self.log_test(f"Create player {name}", True, f"User ID: {response['userId']}")
            else:
                self.log_test(f"Create player {name}", False, f"Error: {response}")
                return False
        
        return len(self.user_ids) == 5

    def create_room(self):
        """Create a new game room"""
        print("\n🏰 Creating game room...")
        
        success, response = self.make_request("POST", "rooms", 200)
        
        if success and 'code' in response:
            self.room_code = response['code']
            self.log_test("Create room", True, f"Room code: {self.room_code}")
            return True
        else:
            self.log_test("Create room", False, f"Error: {response}")
            return False

    def join_all_players(self):
        """Join all 5 players to the room"""
        print("\n👥 Adding all players to the room...")
        
        for i, (user_id, name) in enumerate(zip(self.user_ids, self.player_names)):
            success, response = self.make_request(
                "POST",
                f"rooms/{self.room_code}/join",
                200,
                params={"player_id": user_id, "player_name": name}
            )
            
            if success:
                self.log_test(f"Join player {name}", True, f"Seat assigned")
            else:
                self.log_test(f"Join player {name}", False, f"Error: {response}")
                return False
        
        return True

    def verify_room_state(self):
        """Verify room has all 5 players with correct information"""
        print("\n🔍 Verifying room state...")
        
        success, response = self.make_request("GET", f"rooms/{self.room_code}", 200)
        
        if success and 'players' in response:
            players = response['players']
            
            # Check player count
            if len(players) == 5:
                self.log_test("Player count", True, "5 players in room")
            else:
                self.log_test("Player count", False, f"Expected 5, got {len(players)}")
                return False
            
            # Check player details
            print("   Players in room:")
            for player in players:
                print(f"     - {player['name']} (Seat {player['seat']}, Connected: {player['connected']})")
            
            # Verify all players have real names (not generic)
            real_names = [p['name'] for p in players if p['name'] in self.player_names]
            if len(real_names) == 5:
                self.log_test("Player names", True, "All players have medieval names")
            else:
                self.log_test("Player names", False, "Some players have generic names")
            
            return True
        else:
            self.log_test("Room state verification", False, f"Error: {response}")
            return False

    def start_game(self):
        """Start the game to enter gaming mode"""
        print("\n🎮 Starting the game...")
        
        success, response = self.make_request("POST", f"rooms/{self.room_code}/start", 200)
        
        if success:
            self.log_test("Start game", True, "Game started successfully")
            return True
        else:
            self.log_test("Start game", False, f"Error: {response}")
            return False

    def test_game_state_api(self):
        """Test the game_state API for all players"""
        print("\n🎭 Testing game_state API for all players...")
        
        all_success = True
        roles_found = []
        
        for i, (user_id, name) in enumerate(zip(self.user_ids, self.player_names)):
            success, response = self.make_request(
                "GET",
                f"rooms/{self.room_code}/game_state",
                200,
                params={"player_id": user_id}
            )
            
            if success:
                # Verify essential fields for medieval interface
                required_fields = [
                    'status', 'phase', 'regent_seat', 'tracks', 
                    'your_role', 'players', 'crisis'
                ]
                
                missing_fields = [field for field in required_fields if field not in response]
                
                if not missing_fields:
                    role = response.get('your_role', 'UNKNOWN')
                    roles_found.append(role)
                    self.log_test(f"Game state for {name}", True, f"Role: {role}, Phase: {response.get('phase')}")
                else:
                    self.log_test(f"Game state for {name}", False, f"Missing fields: {missing_fields}")
                    all_success = False
            else:
                self.log_test(f"Game state for {name}", False, f"Error: {response}")
                all_success = False
        
        # Verify role distribution for 5 players (should be 3 LOYAL, 1 CONJURE, 1 USURPATEUR)
        if all_success:
            role_counts = {
                'LOYAL': roles_found.count('LOYAL'),
                'CONJURE': roles_found.count('CONJURE'),
                'USURPATEUR': roles_found.count('USURPATEUR')
            }
            
            expected = {'LOYAL': 3, 'CONJURE': 1, 'USURPATEUR': 1}
            if role_counts == expected:
                self.log_test("Role distribution", True, f"Correct: {role_counts}")
            else:
                self.log_test("Role distribution", False, f"Expected {expected}, got {role_counts}")
                all_success = False
        
        return all_success

    def verify_medieval_interface_data(self):
        """Verify all data needed for medieval interface is present"""
        print("\n🏰 Verifying medieval interface data requirements...")
        
        # Get game state for first player to check general data
        success, game_state = self.make_request(
            "GET",
            f"rooms/{self.room_code}/game_state",
            200,
            params={"player_id": self.user_ids[0]}
        )
        
        if not success:
            self.log_test("Medieval interface data", False, "Could not get game state")
            return False
        
        # Check required data for medieval interface
        checks = [
            ("Players with seats", 'players' in game_state and len(game_state['players']) == 5),
            ("Current phase", 'phase' in game_state and game_state['phase'] == 'NOMINATION'),
            ("Tracks (loyal/conjure/crisis)", 'tracks' in game_state and 'crisis' in game_state),
            ("Regent identified", 'regent_seat' in game_state and game_state['regent_seat'] == 1),
            ("Game status", 'status' in game_state and game_state['status'] == 'in_progress'),
        ]
        
        all_good = True
        for check_name, condition in checks:
            if condition:
                self.log_test(check_name, True)
            else:
                self.log_test(check_name, False)
                all_good = False
        
        # Display key information for medieval interface
        if all_good:
            print("\n📋 Medieval Interface Data Summary:")
            print(f"   Room Code: {self.room_code}")
            print(f"   Phase: {game_state.get('phase')}")
            print(f"   Regent: Seat {game_state.get('regent_seat')} ({self.player_names[0]})")
            print(f"   Tracks: Loyal={game_state['tracks']['loyal']}, Conjure={game_state['tracks']['conjure']}, Crisis={game_state['crisis']}")
            print("   Players:")
            for player in game_state['players']:
                print(f"     - {player['name']} (Seat {player['seat']})")
        
        return all_good

    def run_complete_test(self):
        """Run the complete test setup for medieval interface"""
        print("🏰 MEDIEVAL INTERFACE TEST SETUP")
        print("=" * 50)
        print("Creating a test room with 5 players for medieval interface testing")
        print()
        
        # Run all setup steps
        steps = [
            ("Create 5 players", self.create_players),
            ("Create room", self.create_room),
            ("Join all players", self.join_all_players),
            ("Verify room state", self.verify_room_state),
            ("Start game", self.start_game),
            ("Test game_state API", self.test_game_state_api),
            ("Verify medieval interface data", self.verify_medieval_interface_data),
        ]
        
        for step_name, step_func in steps:
            print(f"\n{'='*20} {step_name.upper()} {'='*20}")
            try:
                if not step_func():
                    print(f"\n❌ FAILED at step: {step_name}")
                    return False
            except Exception as e:
                print(f"\n💥 CRASHED at step {step_name}: {str(e)}")
                return False
        
        return True

    def print_final_results(self):
        """Print final test results and room information"""
        print(f"\n{'='*50}")
        print("📊 FINAL RESULTS")
        print(f"{'='*50}")
        print(f"Tests Run: {self.tests_run}")
        print(f"Tests Passed: {self.tests_passed}")
        print(f"Tests Failed: {self.tests_run - self.tests_passed}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed / self.tests_run) * 100
            print(f"Success Rate: {success_rate:.1f}%")
        
        if self.room_code:
            print(f"\n🏰 MEDIEVAL INTERFACE TEST ROOM")
            print(f"{'='*50}")
            print(f"Room Code: {self.room_code}")
            print(f"Frontend URL: {self.base_url}")
            print(f"Direct Room URL: {self.base_url}/?room={self.room_code}")
            print()
            print("👥 Players created:")
            for i, (user_id, name) in enumerate(zip(self.user_ids, self.player_names)):
                print(f"   {i+1}. {name} (ID: {user_id})")
            print()
            print("🎮 Game Status: Started in NOMINATION phase")
            print("👑 Regent: Alice (Seat 1)")
            print()
            print("✨ Ready for medieval interface testing!")
            print("   You can now use this room to test the MedievalGameRoom component")

def main():
    """Main function to run the medieval interface test setup"""
    tester = MedievalInterfaceTestSetup()
    
    success = tester.run_complete_test()
    tester.print_final_results()
    
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())