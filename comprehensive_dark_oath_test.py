#!/usr/bin/env python3
"""
Comprehensive Dark Oath (Secretus Regnum) Backend API Test Suite
Tests all critical endpoints after recent frontend changes
"""

import requests
import sys
import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple

class DarkOathAPITester:
    def __init__(self, base_url="https://deduction-game-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.room_code = None
        self.players = []  # List of {id, name, token}
        self.game_state = None
        
        # Test data - realistic medieval names
        self.player_names = ["Alice", "Bob", "Charlie", "Diana", "Eve"]
        
    def log(self, message: str, level: str = "INFO"):
        """Log a message with timestamp"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")
        
    def run_test(self, name: str, method: str, endpoint: str, expected_status: int, 
                 data: Optional[Dict] = None, params: Optional[Dict] = None) -> Tuple[bool, Dict]:
        """Run a single API test"""
        url = f"{self.api_url}/{endpoint}" if endpoint else self.api_url
        headers = {'Content-Type': 'application/json'}

        self.tests_run += 1
        self.log(f"🔍 Testing {name}...")
        self.log(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=15)
            elif method == 'POST':
                if data:
                    response = requests.post(url, json=data, headers=headers, params=params, timeout=15)
                else:
                    response = requests.post(url, headers=headers, params=params, timeout=15)

            self.log(f"   Status Code: {response.status_code}")
            
            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"✅ PASSED - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if len(str(response_data)) < 500:  # Only show short responses
                        self.log(f"   Response: {json.dumps(response_data, indent=2)}")
                    else:
                        self.log(f"   Response: Large response received ({len(str(response_data))} chars)")
                    return True, response_data
                except:
                    return True, {}
            else:
                self.log(f"❌ FAILED - Expected {expected_status}, got {response.status_code}", "ERROR")
                try:
                    error_data = response.json()
                    self.log(f"   Error Response: {json.dumps(error_data, indent=2)}", "ERROR")
                except:
                    self.log(f"   Error Text: {response.text}", "ERROR")
                return False, {}

        except requests.exceptions.Timeout:
            self.log(f"❌ FAILED - Request timed out", "ERROR")
            return False, {}
        except requests.exceptions.ConnectionError:
            self.log(f"❌ FAILED - Connection error", "ERROR")
            return False, {}
        except Exception as e:
            self.log(f"❌ FAILED - Error: {str(e)}", "ERROR")
            return False, {}

    def test_1_room_creation_management(self) -> bool:
        """Test 1: Room creation and management endpoints"""
        self.log("=" * 60)
        self.log("🏰 TESTING ROOM CREATION AND MANAGEMENT")
        self.log("=" * 60)
        
        # Test root endpoint
        success, _ = self.run_test("Root API Endpoint", "GET", "", 200)
        if not success:
            return False
            
        # Test room creation
        success, response = self.run_test("Create Room", "POST", "rooms", 200)
        if not success or 'code' not in response:
            return False
            
        self.room_code = response['code']
        self.log(f"✅ Room created with code: {self.room_code}")
        
        # Test get room info
        success, response = self.run_test(
            "Get Room Information", 
            "GET", 
            f"rooms/{self.room_code}", 
            200
        )
        if not success:
            return False
            
        # Verify room structure
        required_fields = ['code', 'status', 'players']
        for field in required_fields:
            if field not in response:
                self.log(f"❌ Missing required field in room response: {field}", "ERROR")
                return False
                
        self.log("✅ Room management endpoints working correctly")
        return True

    def test_2_player_authentication(self) -> bool:
        """Test 2: Player authentication endpoint"""
        self.log("=" * 60)
        self.log("👤 TESTING PLAYER AUTHENTICATION")
        self.log("=" * 60)
        
        # Create 5 players for full game testing
        for i, name in enumerate(self.player_names):
            success, response = self.run_test(
                f"Create Anonymous User - {name}",
                "POST",
                "auth/anonymous",
                200,
                params={"name": name}
            )
            
            if not success:
                return False
                
            # Verify response structure
            required_fields = ['userId', 'token', 'name']
            for field in required_fields:
                if field not in response:
                    self.log(f"❌ Missing required field in auth response: {field}", "ERROR")
                    return False
                    
            player = {
                'id': response['userId'],
                'name': response['name'],
                'token': response['token']
            }
            self.players.append(player)
            self.log(f"✅ Created player: {name} (ID: {player['id'][:8]}...)")
            
        self.log(f"✅ All {len(self.players)} players authenticated successfully")
        return True

    def test_3_room_joining(self) -> bool:
        """Test 3: Players joining the room"""
        self.log("=" * 60)
        self.log("🚪 TESTING ROOM JOINING")
        self.log("=" * 60)
        
        if not self.room_code or not self.players:
            self.log("❌ Cannot test room joining - missing room or players", "ERROR")
            return False
            
        # Join all players to the room
        for player in self.players:
            success, response = self.run_test(
                f"Join Room - {player['name']}",
                "POST",
                f"rooms/{self.room_code}/join",
                200,
                params={
                    "player_id": player['id'],
                    "player_name": player['name']
                }
            )
            
            if not success:
                return False
                
        # Verify all players joined
        success, response = self.run_test(
            "Verify All Players Joined",
            "GET",
            f"rooms/{self.room_code}",
            200
        )
        
        if not success:
            return False
            
        if len(response.get('players', [])) != 5:
            self.log(f"❌ Expected 5 players, found {len(response.get('players', []))}", "ERROR")
            return False
            
        self.log("✅ All players successfully joined the room")
        return True

    def test_4_game_start_and_state(self) -> bool:
        """Test 4: Game start and state APIs"""
        self.log("=" * 60)
        self.log("🎮 TESTING GAME START AND STATE APIS")
        self.log("=" * 60)
        
        if not self.room_code or not self.players:
            self.log("❌ Cannot test game start - missing room or players", "ERROR")
            return False
            
        # Start the game
        success, response = self.run_test(
            "Start Game",
            "POST",
            f"rooms/{self.room_code}/start",
            200
        )
        
        if not success:
            return False
            
        # Test game state for each player
        for i, player in enumerate(self.players):
            success, response = self.run_test(
                f"Get Game State - {player['name']}",
                "GET",
                f"rooms/{self.room_code}/game_state",
                200,
                params={"player_id": player['id']}
            )
            
            if not success:
                return False
                
            # Verify game state structure
            required_fields = [
                'status', 'phase', 'regent_seat', 'tracks', 'your_role', 
                'players', 'version', 'crisis'
            ]
            for field in required_fields:
                if field not in response:
                    self.log(f"❌ Missing required field in game state: {field}", "ERROR")
                    return False
                    
            # Store game state for later tests
            if i == 0:
                self.game_state = response
                self.log(f"✅ Game started - Phase: {response['phase']}, Regent: Seat {response['regent_seat']}")
                
        self.log("✅ Game state APIs working correctly")
        return True

    def test_5_game_actions_nomination(self) -> bool:
        """Test 5: Game actions - Nomination phase"""
        self.log("=" * 60)
        self.log("⚔️ TESTING GAME ACTIONS - NOMINATION")
        self.log("=" * 60)
        
        if not self.game_state:
            self.log("❌ Cannot test nominations - no game state", "ERROR")
            return False
            
        # Find the regent
        regent_seat = self.game_state['regent_seat']
        regent_player = None
        for player in self.players:
            # Get current game state to find regent
            success, state = self.run_test(
                f"Get Current State for {player['name']}",
                "GET",
                f"rooms/{self.room_code}/game_state",
                200,
                params={"player_id": player['id']}
            )
            if success:
                player_seat = None
                for p in state['players']:
                    if p['id'] == player['id']:
                        player_seat = p['seat']
                        break
                if player_seat == regent_seat:
                    regent_player = player
                    break
                    
        if not regent_player:
            self.log("❌ Could not find regent player", "ERROR")
            return False
            
        self.log(f"✅ Found regent: {regent_player['name']} (Seat {regent_seat})")
        
        # Find a valid nominee (not regent, not in previous government)
        nominee_seat = None
        for seat in range(1, 6):
            if seat != regent_seat:
                nominee_seat = seat
                break
                
        if not nominee_seat:
            self.log("❌ Could not find valid nominee", "ERROR")
            return False
            
        # Test nomination
        success, response = self.run_test(
            f"Nominate Player - Seat {nominee_seat}",
            "POST",
            f"rooms/{self.room_code}/action",
            200,
            params={
                "player_id": regent_player['id'],
                "action_type": "NOMINATE"
            },
            data={"nomineeSeat": nominee_seat}
        )
        
        if not success:
            return False
            
        # Verify phase changed to VOTE
        success, state = self.run_test(
            "Verify Phase Changed to VOTE",
            "GET",
            f"rooms/{self.room_code}/game_state",
            200,
            params={"player_id": regent_player['id']}
        )
        
        if not success:
            return False
            
        if state['phase'] != 'VOTE':
            self.log(f"❌ Expected VOTE phase, got {state['phase']}", "ERROR")
            return False
            
        self.game_state = state
        self.log(f"✅ Nomination successful - Nominee: Seat {nominee_seat}, Phase: {state['phase']}")
        return True

    def test_6_game_actions_voting(self) -> bool:
        """Test 6: Game actions - Voting phase"""
        self.log("=" * 60)
        self.log("🗳️ TESTING GAME ACTIONS - VOTING")
        self.log("=" * 60)
        
        if not self.game_state or self.game_state['phase'] != 'VOTE':
            self.log("❌ Cannot test voting - not in VOTE phase", "ERROR")
            return False
            
        regent_seat = self.game_state['regent_seat']
        nominee_seat = self.game_state['nominee_seat']
        
        # Test that regent cannot vote
        regent_player = None
        for player in self.players:
            success, state = self.run_test(
                f"Get State for {player['name']}",
                "GET",
                f"rooms/{self.room_code}/game_state",
                200,
                params={"player_id": player['id']}
            )
            if success:
                for p in state['players']:
                    if p['id'] == player['id'] and p['seat'] == regent_seat:
                        regent_player = player
                        break
                        
        if regent_player:
            success, response = self.run_test(
                "Test Regent Cannot Vote (Expected Failure)",
                "POST",
                f"rooms/{self.room_code}/action",
                400,  # Should fail
                params={
                    "player_id": regent_player['id'],
                    "action_type": "VOTE"
                },
                data={"vote": "oui"}
            )
            
            if not success:
                self.log("❌ Regent voting restriction not working", "ERROR")
                return False
                
        # Test that nominee cannot vote
        nominee_player = None
        for player in self.players:
            success, state = self.run_test(
                f"Get State for {player['name']}",
                "GET",
                f"rooms/{self.room_code}/game_state",
                200,
                params={"player_id": player['id']}
            )
            if success:
                for p in state['players']:
                    if p['id'] == player['id'] and p['seat'] == nominee_seat:
                        nominee_player = player
                        break
                        
        if nominee_player:
            success, response = self.run_test(
                "Test Nominee Cannot Vote (Expected Failure)",
                "POST",
                f"rooms/{self.room_code}/action",
                400,  # Should fail
                params={
                    "player_id": nominee_player['id'],
                    "action_type": "VOTE"
                },
                data={"vote": "oui"}
            )
            
            if not success:
                self.log("❌ Nominee voting restriction not working", "ERROR")
                return False
                
        # Vote with eligible players (all vote "oui" to elect government)
        eligible_voters = []
        for player in self.players:
            success, state = self.run_test(
                f"Get State for {player['name']}",
                "GET",
                f"rooms/{self.room_code}/game_state",
                200,
                params={"player_id": player['id']}
            )
            if success:
                for p in state['players']:
                    if (p['id'] == player['id'] and 
                        p['seat'] != regent_seat and 
                        p['seat'] != nominee_seat):
                        eligible_voters.append(player)
                        break
                        
        self.log(f"✅ Found {len(eligible_voters)} eligible voters")
        
        # Cast votes
        for voter in eligible_voters:
            success, response = self.run_test(
                f"Vote OUI - {voter['name']}",
                "POST",
                f"rooms/{self.room_code}/action",
                200,
                params={
                    "player_id": voter['id'],
                    "action_type": "VOTE"
                },
                data={"vote": "oui"}
            )
            
            if not success:
                return False
                
        # Verify phase changed to LEGIS_REGENT
        success, state = self.run_test(
            "Verify Phase Changed to LEGIS_REGENT",
            "GET",
            f"rooms/{self.room_code}/game_state",
            200,
            params={"player_id": self.players[0]['id']}
        )
        
        if not success:
            return False
            
        if state['phase'] != 'LEGIS_REGENT':
            self.log(f"❌ Expected LEGIS_REGENT phase, got {state['phase']}", "ERROR")
            return False
            
        self.game_state = state
        self.log("✅ Voting successful - Government elected, moved to legislative phase")
        return True

    def test_7_game_actions_legislative(self) -> bool:
        """Test 7: Game actions - Legislative phase"""
        self.log("=" * 60)
        self.log("📜 TESTING GAME ACTIONS - LEGISLATIVE")
        self.log("=" * 60)
        
        if not self.game_state or self.game_state['phase'] != 'LEGIS_REGENT':
            self.log("❌ Cannot test legislative - not in LEGIS_REGENT phase", "ERROR")
            return False
            
        # Find regent player
        regent_seat = self.game_state['regent_seat']
        regent_player = None
        for player in self.players:
            success, state = self.run_test(
                f"Get State for {player['name']}",
                "GET",
                f"rooms/{self.room_code}/game_state",
                200,
                params={"player_id": player['id']}
            )
            if success:
                for p in state['players']:
                    if p['id'] == player['id'] and p['seat'] == regent_seat:
                        regent_player = player
                        # Check if regent can see legislative cards
                        if 'legislative_cards' in state and len(state['legislative_cards']) > 0:
                            self.log(f"✅ Regent can see {len(state['legislative_cards'])} legislative cards")
                        break
                        
        if not regent_player:
            self.log("❌ Could not find regent player", "ERROR")
            return False
            
        # Test regent discarding a card
        success, response = self.run_test(
            "Regent Discard Card",
            "POST",
            f"rooms/{self.room_code}/action",
            200,
            params={
                "player_id": regent_player['id'],
                "action_type": "DISCARD"
            },
            data={"cardId": 0}  # Discard first card
        )
        
        if not success:
            return False
            
        # Verify phase changed to LEGIS_CHAMBELLAN
        success, state = self.run_test(
            "Verify Phase Changed to LEGIS_CHAMBELLAN",
            "GET",
            f"rooms/{self.room_code}/game_state",
            200,
            params={"player_id": regent_player['id']}
        )
        
        if not success:
            return False
            
        if state['phase'] != 'LEGIS_CHAMBELLAN':
            self.log(f"❌ Expected LEGIS_CHAMBELLAN phase, got {state['phase']}", "ERROR")
            return False
            
        # Find chambellan (nominee) player
        nominee_seat = state['nominee_seat']
        chambellan_player = None
        for player in self.players:
            success, chambellan_state = self.run_test(
                f"Get State for {player['name']}",
                "GET",
                f"rooms/{self.room_code}/game_state",
                200,
                params={"player_id": player['id']}
            )
            if success:
                for p in chambellan_state['players']:
                    if p['id'] == player['id'] and p['seat'] == nominee_seat:
                        chambellan_player = player
                        # Check if chambellan can see legislative cards
                        if 'legislative_cards' in chambellan_state and len(chambellan_state['legislative_cards']) > 0:
                            self.log(f"✅ Chambellan can see {len(chambellan_state['legislative_cards'])} legislative cards")
                        break
                        
        if not chambellan_player:
            self.log("❌ Could not find chambellan player", "ERROR")
            return False
            
        # Test chambellan adopting a card
        success, response = self.run_test(
            "Chambellan Adopt Card",
            "POST",
            f"rooms/{self.room_code}/action",
            200,
            params={
                "player_id": chambellan_player['id'],
                "action_type": "DISCARD"
            },
            data={"cardId": 0}  # Adopt first card
        )
        
        if not success:
            return False
            
        # Verify tracks were updated and phase changed
        success, final_state = self.run_test(
            "Verify Legislative Action Completed",
            "GET",
            f"rooms/{self.room_code}/game_state",
            200,
            params={"player_id": self.players[0]['id']}
        )
        
        if not success:
            return False
            
        # Check that tracks were updated
        if 'tracks' not in final_state:
            self.log("❌ Tracks not found in game state", "ERROR")
            return False
            
        tracks = final_state['tracks']
        total_decrees = tracks.get('loyal', 0) + tracks.get('conjure', 0)
        if total_decrees == 0:
            self.log("❌ No decrees were enacted", "ERROR")
            return False
            
        self.game_state = final_state
        self.log(f"✅ Legislative phase completed - Loyal: {tracks.get('loyal', 0)}, Conjuré: {tracks.get('conjure', 0)}")
        return True

    def test_8_chat_system(self) -> bool:
        """Test 8: Chat system endpoints"""
        self.log("=" * 60)
        self.log("💬 TESTING CHAT SYSTEM")
        self.log("=" * 60)
        
        if not self.room_code or not self.players:
            self.log("❌ Cannot test chat - missing room or players", "ERROR")
            return False
            
        # Test GET chat history (should be empty initially)
        success, response = self.run_test(
            "Get Initial Chat History",
            "GET",
            f"rooms/{self.room_code}/chat",
            200,
            params={"player_id": self.players[0]['id']}
        )
        
        if not success:
            return False
            
        if 'messages' not in response:
            self.log("❌ Chat history response missing 'messages' field", "ERROR")
            return False
            
        # Test sending chat messages
        test_messages = [
            "Greetings, fellow nobles!",
            "The realm is in danger...",
            "We must choose wisely."
        ]
        
        for i, message in enumerate(test_messages):
            player = self.players[i % len(self.players)]
            success, response = self.run_test(
                f"Send Chat Message - {player['name']}",
                "POST",
                f"rooms/{self.room_code}/chat",
                200,
                params={
                    "player_id": player['id'],
                    "message": message
                }
            )
            
            if not success:
                return False
                
            # Verify message structure
            if 'message' not in response:
                self.log("❌ Chat response missing 'message' field", "ERROR")
                return False
                
            msg = response['message']
            required_fields = ['id', 'player_id', 'player_name', 'message', 'timestamp', 'type']
            for field in required_fields:
                if field not in msg:
                    self.log(f"❌ Chat message missing required field: {field}", "ERROR")
                    return False
                    
        # Test getting updated chat history
        success, response = self.run_test(
            "Get Updated Chat History",
            "GET",
            f"rooms/{self.room_code}/chat",
            200,
            params={"player_id": self.players[0]['id']}
        )
        
        if not success:
            return False
            
        messages = response.get('messages', [])
        if len(messages) != len(test_messages):
            self.log(f"❌ Expected {len(test_messages)} messages, found {len(messages)}", "ERROR")
            return False
            
        self.log(f"✅ Chat system working - {len(messages)} messages sent and retrieved")
        return True

    def test_9_error_handling(self) -> bool:
        """Test 9: Error handling for invalid requests"""
        self.log("=" * 60)
        self.log("🚫 TESTING ERROR HANDLING")
        self.log("=" * 60)
        
        # Test invalid room code
        success, response = self.run_test(
            "Invalid Room Code",
            "GET",
            "rooms/INVALID",
            404
        )
        if not success:
            return False
            
        # Test invalid player ID for game state
        if self.room_code:
            success, response = self.run_test(
                "Invalid Player ID for Game State",
                "GET",
                f"rooms/{self.room_code}/game_state",
                404,
                params={"player_id": "invalid-player-id"}
            )
            if not success:
                return False
                
        # Test invalid action
        if self.room_code and self.players:
            success, response = self.run_test(
                "Invalid Action Type",
                "POST",
                f"rooms/{self.room_code}/action",
                400,
                params={
                    "player_id": self.players[0]['id'],
                    "action_type": "INVALID_ACTION"
                }
            )
            if not success:
                return False
                
        self.log("✅ Error handling working correctly")
        return True

    def run_comprehensive_test(self) -> bool:
        """Run the complete test suite"""
        self.log("🏰 STARTING COMPREHENSIVE DARK OATH BACKEND TEST SUITE")
        self.log("=" * 80)
        
        test_functions = [
            ("Room Creation & Management", self.test_1_room_creation_management),
            ("Player Authentication", self.test_2_player_authentication),
            ("Room Joining", self.test_3_room_joining),
            ("Game Start & State APIs", self.test_4_game_start_and_state),
            ("Game Actions - Nomination", self.test_5_game_actions_nomination),
            ("Game Actions - Voting", self.test_6_game_actions_voting),
            ("Game Actions - Legislative", self.test_7_game_actions_legislative),
            ("Chat System", self.test_8_chat_system),
            ("Error Handling", self.test_9_error_handling),
        ]
        
        all_passed = True
        
        for test_name, test_func in test_functions:
            self.log(f"\n🔥 STARTING: {test_name}")
            try:
                result = test_func()
                if result:
                    self.log(f"✅ COMPLETED: {test_name}")
                else:
                    self.log(f"❌ FAILED: {test_name}", "ERROR")
                    all_passed = False
            except Exception as e:
                self.log(f"💥 CRASHED: {test_name} - {str(e)}", "ERROR")
                all_passed = False
                
        return all_passed

    def print_final_results(self):
        """Print comprehensive test results"""
        self.log("=" * 80)
        self.log("📊 COMPREHENSIVE TEST RESULTS")
        self.log("=" * 80)
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        
        self.log(f"🎯 Total Tests Run: {self.tests_run}")
        self.log(f"✅ Tests Passed: {self.tests_passed}")
        self.log(f"❌ Tests Failed: {self.tests_run - self.tests_passed}")
        self.log(f"📈 Success Rate: {success_rate:.1f}%")
        
        if self.room_code:
            self.log(f"🏰 Test Room Code: {self.room_code}")
            self.log(f"👥 Players Created: {len(self.players)}")
            
        if success_rate == 100:
            self.log("🎉 ALL TESTS PASSED - BACKEND IS FULLY OPERATIONAL!")
        elif success_rate >= 90:
            self.log("⚠️ MOSTLY WORKING - Minor issues detected")
        else:
            self.log("🚨 CRITICAL ISSUES DETECTED - Backend needs attention")
            
        return success_rate == 100

def main():
    """Main test execution"""
    print("🏰 Dark Oath (Secretus Regnum) Comprehensive Backend Test")
    print("Testing all critical endpoints after recent frontend changes")
    print("=" * 80)
    
    tester = DarkOathAPITester()
    
    try:
        success = tester.run_comprehensive_test()
        final_success = tester.print_final_results()
        
        return 0 if final_success else 1
        
    except KeyboardInterrupt:
        tester.log("🛑 Test interrupted by user", "WARNING")
        return 1
    except Exception as e:
        tester.log(f"💥 Test suite crashed: {str(e)}", "ERROR")
        return 1

if __name__ == "__main__":
    sys.exit(main())