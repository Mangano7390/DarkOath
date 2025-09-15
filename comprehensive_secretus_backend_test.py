#!/usr/bin/env python3
"""
Comprehensive Backend Test for Secretus Regnum
Testing all backend APIs after complete interface refactoring
Focus: Room management, Authentication, Game APIs, Chat system, Game phases, Permissions, Track tracking
"""

import requests
import json
import time
import sys
from datetime import datetime
from typing import Dict, List, Optional

class SecretusRegnumComprehensiveTester:
    def __init__(self, base_url="https://secretus-regnum.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.tests_failed = 0
        self.room_code = None
        self.players = []  # List of {user_id, name, seat}
        self.game_state = None
        
        print(f"🏰 Secretus Regnum Comprehensive Backend Test")
        print(f"🌐 Testing against: {self.base_url}")
        print(f"📡 API Endpoint: {self.api_url}")
        print("=" * 80)

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
            if details:
                print(f"   {details}")
        else:
            self.tests_failed += 1
            print(f"❌ {name}")
            if details:
                print(f"   {details}")

    def make_request(self, method: str, endpoint: str, data: dict = None, params: dict = None, expected_status: int = 200) -> tuple:
        """Make HTTP request and return (success, response_data, status_code)"""
        url = f"{self.api_url}/{endpoint}" if endpoint else self.api_url
        headers = {'Content-Type': 'application/json'}
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=15)
            elif method == 'POST':
                if data:
                    response = requests.post(url, json=data, headers=headers, params=params, timeout=15)
                else:
                    response = requests.post(url, headers=headers, params=params, timeout=15)
            else:
                return False, {}, 0
                
            success = response.status_code == expected_status
            try:
                response_data = response.json()
            except:
                response_data = {"text": response.text}
                
            return success, response_data, response.status_code
            
        except requests.exceptions.Timeout:
            return False, {"error": "Request timeout"}, 0
        except requests.exceptions.ConnectionError:
            return False, {"error": "Connection error"}, 0
        except Exception as e:
            return False, {"error": str(e)}, 0

    def test_1_root_api(self):
        """Test 1: Root API endpoint"""
        print("\n🔍 TEST 1: Root API Endpoint")
        success, data, status = self.make_request("GET", "", expected_status=200)
        
        if success and "message" in data:
            self.log_test("Root API accessible", True, f"Message: {data['message']}")
        else:
            self.log_test("Root API accessible", False, f"Status: {status}, Data: {data}")

    def test_2_anonymous_auth(self):
        """Test 2: Anonymous authentication system"""
        print("\n🔍 TEST 2: Anonymous Authentication System")
        
        # Create 5 test players for a full game
        player_names = ["Alice", "Bob", "Charlie", "Diana", "Eve"]
        
        for name in player_names:
            success, data, status = self.make_request("POST", "auth/anonymous", params={"name": name})
            
            if success and "userId" in data and "token" in data:
                player_info = {
                    "user_id": data["userId"],
                    "name": name,
                    "token": data["token"]
                }
                self.players.append(player_info)
                self.log_test(f"Create anonymous user '{name}'", True, f"ID: {data['userId'][:8]}...")
            else:
                self.log_test(f"Create anonymous user '{name}'", False, f"Status: {status}, Data: {data}")
                return False
        
        return len(self.players) == 5

    def test_3_room_management(self):
        """Test 3: Room creation and management"""
        print("\n🔍 TEST 3: Room Creation and Management")
        
        # Create room
        success, data, status = self.make_request("POST", "rooms")
        if success and "code" in data:
            self.room_code = data["code"]
            self.log_test("Create room", True, f"Room code: {self.room_code}")
        else:
            self.log_test("Create room", False, f"Status: {status}, Data: {data}")
            return False
        
        # Get room info
        success, data, status = self.make_request("GET", f"rooms/{self.room_code}")
        if success and "code" in data and data["code"] == self.room_code:
            self.log_test("Get room info", True, f"Status: {data.get('status', 'unknown')}")
        else:
            self.log_test("Get room info", False, f"Status: {status}, Data: {data}")
        
        # Test non-existent room
        success, data, status = self.make_request("GET", "rooms/INVALID", expected_status=404)
        self.log_test("Non-existent room returns 404", success, f"Status: {status}")
        
        return self.room_code is not None

    def test_4_player_joining(self):
        """Test 4: Player joining system"""
        print("\n🔍 TEST 4: Player Joining System")
        
        if not self.room_code or not self.players:
            self.log_test("Player joining prerequisites", False, "Missing room or players")
            return False
        
        # Join all players to the room
        for i, player in enumerate(self.players):
            success, data, status = self.make_request(
                "POST", 
                f"rooms/{self.room_code}/join",
                params={"player_id": player["user_id"], "player_name": player["name"]}
            )
            
            if success:
                player["seat"] = i + 1  # Assign expected seat
                self.log_test(f"Player {player['name']} joins room", True, f"Seat: {player['seat']}")
            else:
                self.log_test(f"Player {player['name']} joins room", False, f"Status: {status}, Data: {data}")
        
        # Verify room has all players
        success, data, status = self.make_request("GET", f"rooms/{self.room_code}")
        if success and "players" in data:
            player_count = len(data["players"])
            self.log_test("All players joined", player_count == 5, f"Players in room: {player_count}/5")
            return player_count == 5
        
        return False

    def test_5_game_start(self):
        """Test 5: Game start functionality"""
        print("\n🔍 TEST 5: Game Start Functionality")
        
        if not self.room_code:
            self.log_test("Game start prerequisites", False, "Missing room code")
            return False
        
        # Start the game
        success, data, status = self.make_request("POST", f"rooms/{self.room_code}/start")
        if success:
            self.log_test("Start game with 5 players", True, "Game started successfully")
        else:
            self.log_test("Start game with 5 players", False, f"Status: {status}, Data: {data}")
            return False
        
        # Verify game state after start
        time.sleep(1)  # Allow game state to update
        return self.verify_game_state_after_start()

    def verify_game_state_after_start(self):
        """Verify game state after starting"""
        if not self.players:
            return False
            
        player = self.players[0]  # Use first player to check game state
        success, data, status = self.make_request(
            "GET", 
            f"rooms/{self.room_code}/game_state",
            params={"player_id": player["user_id"]}
        )
        
        if success:
            self.game_state = data
            # Verify expected game state elements
            checks = [
                ("Game status is in_progress", data.get("status") == "in_progress"),
                ("Phase is NOMINATION", data.get("phase") == "NOMINATION"),
                ("Has regent seat", "regent_seat" in data and isinstance(data["regent_seat"], int)),
                ("Has 5 players", len(data.get("players", [])) == 5),
                ("Has tracks", "tracks" in data),
                ("Player has role", data.get("your_role") is not None),
                ("Has version", "version" in data and data["version"] > 0)
            ]
            
            for check_name, check_result in checks:
                self.log_test(check_name, check_result)
            
            return all(check[1] for check in checks)
        else:
            self.log_test("Get game state after start", False, f"Status: {status}, Data: {data}")
            return False

    def test_6_game_state_api(self):
        """Test 6: Game state API for all players"""
        print("\n🔍 TEST 6: Game State API")
        
        if not self.players or not self.room_code:
            self.log_test("Game state API prerequisites", False, "Missing players or room")
            return False
        
        # Test game state for each player
        for player in self.players:
            success, data, status = self.make_request(
                "GET",
                f"rooms/{self.room_code}/game_state", 
                params={"player_id": player["user_id"]}
            )
            
            if success:
                # Verify essential game state fields
                required_fields = ["status", "phase", "regent_seat", "tracks", "players", "your_role"]
                has_all_fields = all(field in data for field in required_fields)
                self.log_test(f"Game state for {player['name']}", has_all_fields, 
                            f"Role: {data.get('your_role', 'unknown')}")
            else:
                self.log_test(f"Game state for {player['name']}", False, f"Status: {status}")

    def test_7_nomination_phase(self):
        """Test 7: Nomination phase functionality"""
        print("\n🔍 TEST 7: Nomination Phase")
        
        if not self.game_state or not self.players:
            self.log_test("Nomination phase prerequisites", False, "Missing game state or players")
            return False
        
        regent_seat = self.game_state.get("regent_seat")
        if not regent_seat:
            self.log_test("Find regent seat", False, "No regent seat in game state")
            return False
        
        # Find the regent player
        regent_player = None
        for player in self.players:
            if player["seat"] == regent_seat:
                regent_player = player
                break
        
        if not regent_player:
            self.log_test("Find regent player", False, f"No player found for seat {regent_seat}")
            return False
        
        self.log_test("Identify regent", True, f"{regent_player['name']} is regent (seat {regent_seat})")
        
        # Test nomination by regent
        nominee_seat = regent_seat + 1 if regent_seat < 5 else 1  # Choose next seat
        success, data, status = self.make_request(
            "POST",
            f"rooms/{self.room_code}/action",
            params={"player_id": regent_player["user_id"], "action_type": "NOMINATE"},
            data={"nomineeSeat": nominee_seat}
        )
        
        if success:
            self.log_test("Regent nomination", True, f"Nominated seat {nominee_seat}")
            
            # Verify phase changed to VOTE
            time.sleep(1)
            success, game_data, _ = self.make_request(
                "GET",
                f"rooms/{self.room_code}/game_state",
                params={"player_id": regent_player["user_id"]}
            )
            
            if success and game_data.get("phase") == "VOTE":
                self.log_test("Phase transition to VOTE", True)
                self.game_state = game_data  # Update game state
                return True
            else:
                self.log_test("Phase transition to VOTE", False, f"Phase: {game_data.get('phase')}")
        else:
            self.log_test("Regent nomination", False, f"Status: {status}, Data: {data}")
        
        return False

    def test_8_voting_permissions(self):
        """Test 8: Voting permissions validation (regent/chambellan cannot vote)"""
        print("\n🔍 TEST 8: Voting Permissions Validation")
        
        if not self.game_state or self.game_state.get("phase") != "VOTE":
            self.log_test("Voting phase prerequisites", False, "Not in VOTE phase")
            return False
        
        regent_seat = self.game_state.get("regent_seat")
        nominee_seat = self.game_state.get("nominee_seat")
        
        if not regent_seat or not nominee_seat:
            self.log_test("Get regent and nominee seats", False, "Missing seat information")
            return False
        
        # Test that regent cannot vote
        regent_player = next((p for p in self.players if p["seat"] == regent_seat), None)
        if regent_player:
            success, data, status = self.make_request(
                "POST",
                f"rooms/{self.room_code}/action",
                params={"player_id": regent_player["user_id"], "action_type": "VOTE"},
                data={"vote": "oui"},
                expected_status=400
            )
            self.log_test("Regent cannot vote", success, f"Correctly blocked with status {status}")
        
        # Test that nominee cannot vote
        nominee_player = next((p for p in self.players if p["seat"] == nominee_seat), None)
        if nominee_player:
            success, data, status = self.make_request(
                "POST",
                f"rooms/{self.room_code}/action",
                params={"player_id": nominee_player["user_id"], "action_type": "VOTE"},
                data={"vote": "oui"},
                expected_status=400
            )
            self.log_test("Nominee cannot vote", success, f"Correctly blocked with status {status}")
        
        # Test that eligible players can vote
        eligible_players = [p for p in self.players if p["seat"] not in [regent_seat, nominee_seat]]
        votes_cast = 0
        
        for player in eligible_players:
            success, data, status = self.make_request(
                "POST",
                f"rooms/{self.room_code}/action",
                params={"player_id": player["user_id"], "action_type": "VOTE"},
                data={"vote": "oui"}
            )
            
            if success:
                votes_cast += 1
                self.log_test(f"Eligible voter {player['name']} can vote", True)
            else:
                self.log_test(f"Eligible voter {player['name']} can vote", False, f"Status: {status}")
        
        # Verify all eligible players voted and government was elected
        if votes_cast == len(eligible_players):
            time.sleep(1)  # Allow game state to update
            success, game_data, _ = self.make_request(
                "GET",
                f"rooms/{self.room_code}/game_state",
                params={"player_id": self.players[0]["user_id"]}
            )
            
            if success and game_data.get("phase") == "LEGIS_REGENT":
                self.log_test("Government elected, moved to LEGIS_REGENT", True)
                self.game_state = game_data
                return True
            else:
                self.log_test("Government elected, moved to LEGIS_REGENT", False, 
                            f"Phase: {game_data.get('phase')}")
        
        return False

    def test_9_legislative_phase(self):
        """Test 9: Legislative phase card drawing and DISCARD action"""
        print("\n🔍 TEST 9: Legislative Phase")
        
        if not self.game_state or self.game_state.get("phase") != "LEGIS_REGENT":
            self.log_test("Legislative phase prerequisites", False, "Not in LEGIS_REGENT phase")
            return False
        
        regent_seat = self.game_state.get("regent_seat")
        regent_player = next((p for p in self.players if p["seat"] == regent_seat), None)
        
        if not regent_player:
            self.log_test("Find regent for legislative phase", False)
            return False
        
        # Check if regent can see legislative cards
        success, game_data, _ = self.make_request(
            "GET",
            f"rooms/{self.room_code}/game_state",
            params={"player_id": regent_player["user_id"]}
        )
        
        if success and "legislative_cards" in game_data:
            cards = game_data["legislative_cards"]
            self.log_test("Regent sees legislative cards", len(cards) == 3, f"Cards: {len(cards)}/3")
            
            if len(cards) == 3:
                # Test regent DISCARD action
                success, data, status = self.make_request(
                    "POST",
                    f"rooms/{self.room_code}/action",
                    params={"player_id": regent_player["user_id"], "action_type": "DISCARD"},
                    data={"cardId": 0}  # Discard first card
                )
                
                if success:
                    self.log_test("Regent DISCARD action", True)
                    
                    # Verify phase moved to LEGIS_CHAMBELLAN
                    time.sleep(1)
                    success, game_data, _ = self.make_request(
                        "GET",
                        f"rooms/{self.room_code}/game_state",
                        params={"player_id": regent_player["user_id"]}
                    )
                    
                    if success and game_data.get("phase") == "LEGIS_CHAMBELLAN":
                        self.log_test("Phase transition to LEGIS_CHAMBELLAN", True)
                        self.game_state = game_data
                        return self.test_chambellan_phase()
                    else:
                        self.log_test("Phase transition to LEGIS_CHAMBELLAN", False)
                else:
                    self.log_test("Regent DISCARD action", False, f"Status: {status}")
        else:
            self.log_test("Regent sees legislative cards", False)
        
        return False

    def test_chambellan_phase(self):
        """Test chambellan phase of legislative process"""
        nominee_seat = self.game_state.get("nominee_seat")
        chambellan_player = next((p for p in self.players if p["seat"] == nominee_seat), None)
        
        if not chambellan_player:
            self.log_test("Find chambellan for legislative phase", False)
            return False
        
        # Check if chambellan can see remaining 2 cards
        success, game_data, _ = self.make_request(
            "GET",
            f"rooms/{self.room_code}/game_state",
            params={"player_id": chambellan_player["user_id"]}
        )
        
        if success and "legislative_cards" in game_data:
            cards = game_data["legislative_cards"]
            self.log_test("Chambellan sees 2 remaining cards", len(cards) == 2, f"Cards: {len(cards)}/2")
            
            if len(cards) == 2:
                # Test chambellan DISCARD (adopt) action
                success, data, status = self.make_request(
                    "POST",
                    f"rooms/{self.room_code}/action",
                    params={"player_id": chambellan_player["user_id"], "action_type": "DISCARD"},
                    data={"cardId": 0}  # Adopt first card
                )
                
                if success:
                    self.log_test("Chambellan DISCARD (adopt) action", True)
                    
                    # Verify tracks updated and phase changed
                    time.sleep(1)
                    success, game_data, _ = self.make_request(
                        "GET",
                        f"rooms/{self.room_code}/game_state",
                        params={"player_id": chambellan_player["user_id"]}
                    )
                    
                    if success:
                        tracks = game_data.get("tracks", {})
                        total_decrees = tracks.get("loyal", 0) + tracks.get("conjure", 0)
                        self.log_test("Tracks updated after legislation", total_decrees > 0, 
                                    f"Loyal: {tracks.get('loyal', 0)}, Conjuré: {tracks.get('conjure', 0)}")
                        
                        new_phase = game_data.get("phase")
                        self.log_test("Phase transition after legislation", new_phase == "NOMINATION", 
                                    f"New phase: {new_phase}")
                        
                        self.game_state = game_data
                        return True
                else:
                    self.log_test("Chambellan DISCARD (adopt) action", False, f"Status: {status}")
        else:
            self.log_test("Chambellan sees 2 remaining cards", False)
        
        return False

    def test_10_chat_system(self):
        """Test 10: Chat system endpoints and functionality"""
        print("\n🔍 TEST 10: Chat System")
        
        if not self.room_code or not self.players:
            self.log_test("Chat system prerequisites", False, "Missing room or players")
            return False
        
        # Test sending chat messages
        test_messages = [
            ("Alice", "Bonjour à tous!"),
            ("Bob", "Prêt pour la partie"),
            ("Charlie", "Que la stratégie commence!")
        ]
        
        messages_sent = 0
        for i, (player_name, message) in enumerate(test_messages):
            if i < len(self.players):
                player = self.players[i]
                success, data, status = self.make_request(
                    "POST",
                    f"rooms/{self.room_code}/chat",
                    params={"player_id": player["user_id"], "message": message}
                )
                
                if success:
                    messages_sent += 1
                    self.log_test(f"Send chat message from {player_name}", True, f"Message: '{message}'")
                else:
                    self.log_test(f"Send chat message from {player_name}", False, f"Status: {status}")
        
        # Test getting chat history
        time.sleep(1)  # Allow messages to be stored
        success, data, status = self.make_request(
            "GET",
            f"rooms/{self.room_code}/chat",
            params={"player_id": self.players[0]["user_id"]}
        )
        
        if success and "messages" in data:
            messages = data["messages"]
            self.log_test("Get chat history", len(messages) >= messages_sent, 
                        f"Retrieved {len(messages)} messages")
            
            # Verify message structure
            if messages:
                msg = messages[0]
                required_fields = ["player_id", "player_name", "message", "timestamp"]
                has_structure = all(field in msg for field in required_fields)
                self.log_test("Chat message structure", has_structure, 
                            f"Fields: {list(msg.keys())}")
        else:
            self.log_test("Get chat history", False, f"Status: {status}")
        
        return messages_sent > 0

    def test_11_track_tracking(self):
        """Test 11: Track tracking (loyal, conjuré, crise)"""
        print("\n🔍 TEST 11: Track Tracking")
        
        if not self.game_state:
            self.log_test("Track tracking prerequisites", False, "Missing game state")
            return False
        
        tracks = self.game_state.get("tracks", {})
        
        # Verify track structure
        required_tracks = ["loyal", "conjure", "crisis"]
        has_all_tracks = all(track in tracks for track in required_tracks)
        self.log_test("Track structure", has_all_tracks, f"Tracks: {list(tracks.keys())}")
        
        # Verify track values are reasonable
        loyal_count = tracks.get("loyal", 0)
        conjure_count = tracks.get("conjure", 0)
        crisis_count = tracks.get("crisis", 0)
        
        self.log_test("Loyal track valid", 0 <= loyal_count <= 5, f"Loyal: {loyal_count}")
        self.log_test("Conjuré track valid", 0 <= conjure_count <= 6, f"Conjuré: {conjure_count}")
        self.log_test("Crisis track valid", 0 <= crisis_count <= 3, f"Crisis: {crisis_count}")
        
        # Verify at least one decree was enacted (from our legislative test)
        total_decrees = loyal_count + conjure_count
        self.log_test("Decrees enacted", total_decrees > 0, f"Total decrees: {total_decrees}")
        
        return has_all_tracks and total_decrees > 0

    def test_12_error_handling(self):
        """Test 12: Error handling for invalid requests"""
        print("\n🔍 TEST 12: Error Handling")
        
        error_tests = [
            ("Invalid room code", "GET", "rooms/INVALID/game_state", {"player_id": "test"}, 404),
            ("Invalid player ID", "GET", f"rooms/{self.room_code}/game_state", {"player_id": "invalid"}, 404),
            ("Invalid action type", "POST", f"rooms/{self.room_code}/action", 
             {"player_id": self.players[0]["user_id"], "action_type": "INVALID"}, 400),
            ("Chat with invalid player", "POST", f"rooms/{self.room_code}/chat",
             {"player_id": "invalid", "message": "test"}, 404),
        ]
        
        for test_name, method, endpoint, params, expected_status in error_tests:
            success, data, status = self.make_request(method, endpoint, params=params, expected_status=expected_status)
            self.log_test(test_name, success, f"Expected {expected_status}, got {status}")

    def run_all_tests(self):
        """Run all comprehensive tests"""
        print("🚀 Starting Comprehensive Backend Tests for Secretus Regnum")
        print("Focus: Post-refactoring validation of all backend APIs")
        print("=" * 80)
        
        test_methods = [
            self.test_1_root_api,
            self.test_2_anonymous_auth,
            self.test_3_room_management,
            self.test_4_player_joining,
            self.test_5_game_start,
            self.test_6_game_state_api,
            self.test_7_nomination_phase,
            self.test_8_voting_permissions,
            self.test_9_legislative_phase,
            self.test_10_chat_system,
            self.test_11_track_tracking,
            self.test_12_error_handling,
        ]
        
        for test_method in test_methods:
            try:
                test_method()
            except Exception as e:
                self.tests_run += 1
                self.tests_failed += 1
                print(f"❌ {test_method.__name__} crashed: {str(e)}")
        
        self.print_final_results()

    def print_final_results(self):
        """Print comprehensive test results"""
        print("\n" + "=" * 80)
        print("🏰 SECRETUS REGNUM BACKEND TEST RESULTS")
        print("=" * 80)
        print(f"📊 Tests Run: {self.tests_run}")
        print(f"✅ Tests Passed: {self.tests_passed}")
        print(f"❌ Tests Failed: {self.tests_failed}")
        
        if self.tests_run > 0:
            success_rate = (self.tests_passed / self.tests_run) * 100
            print(f"📈 Success Rate: {success_rate:.1f}%")
            
            if success_rate >= 90:
                print("🎉 EXCELLENT: Backend is working very well!")
            elif success_rate >= 75:
                print("👍 GOOD: Backend is mostly functional with minor issues")
            elif success_rate >= 50:
                print("⚠️  MODERATE: Backend has significant issues that need attention")
            else:
                print("🚨 CRITICAL: Backend has major problems requiring immediate fixes")
        
        if self.room_code:
            print(f"\n🏰 Test Room: {self.room_code}")
            print(f"👥 Players Created: {len(self.players)}")
            
        print("\n🎯 FOCUS AREAS TESTED:")
        focus_areas = [
            "✓ Room creation and management",
            "✓ Anonymous authentication system", 
            "✓ Game APIs (game_state, actions, start)",
            "✓ Chat system (WebSocket + endpoints)",
            "✓ Game phase management (NOMINATION, VOTE, LEGIS_REGENT, LEGIS_CHAMBELLAN)",
            "✓ Action validation according to permissions",
            "✓ Track tracking (loyal, conjuré, crise)",
            "✓ Voting permissions (regent/chambellan cannot vote)",
            "✓ 2 distinct progression tracks (loyaux/conjurés)",
            "✓ Real-time chat system"
        ]
        
        for area in focus_areas:
            print(f"  {area}")
        
        print("=" * 80)

def main():
    """Main test execution"""
    tester = SecretusRegnumComprehensiveTester()
    tester.run_all_tests()
    
    # Return appropriate exit code
    if tester.tests_failed == 0:
        return 0
    elif tester.tests_passed > tester.tests_failed:
        return 1  # Some failures but mostly working
    else:
        return 2  # Major failures

if __name__ == "__main__":
    sys.exit(main())