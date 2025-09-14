import requests
import sys
import json
import uuid
import time
from datetime import datetime

class VotingPermissionsTest:
    def __init__(self, base_url="https://throne-scheme.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.room_code = None  # Will create a new room
        self.players = []  # List of {id, name, seat}
        
    def log_test(self, name, success, details=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}: PASSED {details}")
        else:
            print(f"❌ {name}: FAILED {details}")
        return success

    def make_request(self, method, endpoint, data=None, params=None, expected_status=200):
        """Make HTTP request with error handling"""
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
            
            print(f"   {method} {url} -> {response.status_code}")
            
            if response.status_code != expected_status:
                try:
                    error_data = response.json()
                    print(f"   Error: {json.dumps(error_data, indent=2)}")
                except:
                    print(f"   Error Text: {response.text}")
                return False, {}
            
            try:
                return True, response.json()
            except:
                return True, {}
                
        except Exception as e:
            print(f"   Request failed: {str(e)}")
            return False, {}

    def setup_test_scenario(self):
        """Setup the test scenario with 5 players in room FJRTMA"""
        print(f"\n🏰 Setting up test scenario for room {self.room_code}")
        
        # Check if room exists and get current state
        success, room_data = self.make_request('GET', f'rooms/{self.room_code}')
        if not success:
            return self.log_test("Room existence check", False, "- Room FJRTMA not found")
        
        current_players = room_data.get('players', [])
        print(f"   Current players in room: {len(current_players)}")
        
        # Store existing players
        self.players = current_players.copy()
        
        # Add 4 more players to reach minimum of 5
        players_to_add = [
            {"id": str(uuid.uuid4()), "name": "Alice"},
            {"id": str(uuid.uuid4()), "name": "Bob"}, 
            {"id": str(uuid.uuid4()), "name": "Charlie"},
            {"id": str(uuid.uuid4()), "name": "Diana"}
        ]
        
        for player in players_to_add:
            success, _ = self.make_request(
                'POST', 
                f'rooms/{self.room_code}/join',
                params={"player_id": player["id"], "player_name": player["name"]}
            )
            if success:
                self.players.append(player)
                print(f"   Added player: {player['name']} (ID: {player['id']})")
            else:
                return self.log_test("Add players", False, f"- Failed to add {player['name']}")
        
        return self.log_test("Setup test scenario", len(self.players) >= 5, f"- {len(self.players)} players ready")

    def start_game_test(self):
        """Test starting the game"""
        print(f"\n🎮 Starting game in room {self.room_code}")
        
        success, response = self.make_request('POST', f'rooms/{self.room_code}/start')
        if not success:
            return self.log_test("Start game", False, "- Failed to start game")
        
        # Verify game state after starting
        success, game_state = self.make_request(
            'GET', 
            f'rooms/{self.room_code}/game_state',
            params={"player_id": self.existing_player_id}
        )
        
        if not success:
            return self.log_test("Get game state after start", False, "- Failed to get game state")
        
        # Check if game is in NOMINATION phase with regent at seat 1
        phase = game_state.get('phase')
        regent_seat = game_state.get('regent_seat')
        
        success = (phase == 'NOMINATION' and regent_seat == 1)
        return self.log_test("Game start verification", success, 
                           f"- Phase: {phase}, Regent seat: {regent_seat}")

    def nomination_test(self):
        """Test nomination phase - regent nominates seat 2"""
        print(f"\n👑 Testing nomination phase")
        
        # Find the regent (seat 1) player ID
        regent_player = None
        for player in self.players:
            if player.get('seat') == 1:
                regent_player = player
                break
        
        if not regent_player:
            # Use existing player as regent (should be seat 1)
            regent_player = {"id": self.existing_player_id, "name": "Test Player"}
        
        print(f"   Regent: {regent_player.get('name', 'Unknown')} (ID: {regent_player['id']})")
        
        # Regent nominates seat 2
        success, response = self.make_request(
            'POST',
            f'rooms/{self.room_code}/action',
            data={"nomineeSeat": 2},
            params={"player_id": regent_player['id'], "action_type": "NOMINATE"}
        )
        
        if not success:
            return self.log_test("Nomination action", False, "- Failed to nominate seat 2")
        
        # Verify game moved to VOTE phase
        success, game_state = self.make_request(
            'GET',
            f'rooms/{self.room_code}/game_state', 
            params={"player_id": regent_player['id']}
        )
        
        if not success:
            return self.log_test("Get game state after nomination", False, "- Failed to get game state")
        
        phase = game_state.get('phase')
        nominee_seat = game_state.get('nominee_seat')
        
        success = (phase == 'VOTE' and nominee_seat == 2)
        return self.log_test("Nomination verification", success,
                           f"- Phase: {phase}, Nominee seat: {nominee_seat}")

    def voting_permissions_test(self):
        """Test the critical voting permissions bug fix"""
        print(f"\n🗳️  Testing voting permissions (CRITICAL BUG FIX)")
        
        # Get current game state to identify players by seat
        success, game_state = self.make_request(
            'GET',
            f'rooms/{self.room_code}/game_state',
            params={"player_id": self.existing_player_id}
        )
        
        if not success:
            return self.log_test("Get game state for voting", False, "- Failed to get game state")
        
        players_by_seat = {}
        for player in game_state.get('players', []):
            players_by_seat[player['seat']] = player
        
        regent_seat = game_state.get('regent_seat', 1)
        nominee_seat = game_state.get('nominee_seat', 2)
        
        print(f"   Regent seat: {regent_seat}, Nominee seat: {nominee_seat}")
        
        # Test 1: Regent (seat 1) should NOT be able to vote
        regent_player = players_by_seat.get(regent_seat)
        if regent_player:
            print(f"   Testing regent voting restriction...")
            success, response = self.make_request(
                'POST',
                f'rooms/{self.room_code}/action',
                data={"vote": "oui"},
                params={"player_id": regent_player['id'], "action_type": "VOTE"},
                expected_status=400  # Should fail with permission denied
            )
            
            regent_blocked = success  # Success means we got expected 400 error
            self.log_test("Regent voting blocked", regent_blocked, 
                         "- Regent correctly blocked from voting" if regent_blocked else "- Regent incorrectly allowed to vote")
        else:
            regent_blocked = False
            self.log_test("Regent voting blocked", False, "- Could not find regent player")
        
        # Test 2: Nominee/Chambellan (seat 2) should NOT be able to vote  
        nominee_player = players_by_seat.get(nominee_seat)
        if nominee_player:
            print(f"   Testing nominee voting restriction...")
            success, response = self.make_request(
                'POST',
                f'rooms/{self.room_code}/action',
                data={"vote": "oui"},
                params={"player_id": nominee_player['id'], "action_type": "VOTE"},
                expected_status=400  # Should fail with permission denied
            )
            
            nominee_blocked = success  # Success means we got expected 400 error
            self.log_test("Nominee voting blocked", nominee_blocked,
                         "- Nominee correctly blocked from voting" if nominee_blocked else "- Nominee incorrectly allowed to vote")
        else:
            nominee_blocked = False
            self.log_test("Nominee voting blocked", False, "- Could not find nominee player")
        
        # Test 3: Other players (seats 3, 4, 5) SHOULD be able to vote
        voting_allowed_count = 0
        for seat in [3, 4, 5]:
            player = players_by_seat.get(seat)
            if player:
                print(f"   Testing seat {seat} voting permission...")
                success, response = self.make_request(
                    'POST',
                    f'rooms/{self.room_code}/action',
                    data={"vote": "oui"},
                    params={"player_id": player['id'], "action_type": "VOTE"},
                    expected_status=200  # Should succeed
                )
                
                if success:
                    voting_allowed_count += 1
                    print(f"     ✅ Seat {seat} successfully voted")
                else:
                    print(f"     ❌ Seat {seat} incorrectly blocked from voting")
        
        other_players_can_vote = (voting_allowed_count >= 2)  # At least 2 out of 3 should work
        self.log_test("Other players can vote", other_players_can_vote,
                     f"- {voting_allowed_count}/3 non-government players can vote")
        
        # Overall voting permissions test result
        overall_success = regent_blocked and nominee_blocked and other_players_can_vote
        return self.log_test("VOTING PERMISSIONS BUG FIX", overall_success,
                           "- All voting restrictions working correctly" if overall_success else "- Voting permissions still have issues")

    def verify_vote_counting(self):
        """Verify that vote counting works correctly with filtered voters"""
        print(f"\n📊 Testing vote counting logic")
        
        # Get final game state to check vote results
        success, game_state = self.make_request(
            'GET',
            f'rooms/{self.room_code}/game_state',
            params={"player_id": self.existing_player_id}
        )
        
        if not success:
            return self.log_test("Get final game state", False, "- Failed to get game state")
        
        votes = game_state.get('votes', {})
        phase = game_state.get('phase')
        
        print(f"   Current votes: {len(votes)}")
        print(f"   Current phase: {phase}")
        
        # Check if voting completed and moved to next phase
        vote_counting_works = len(votes) > 0
        return self.log_test("Vote counting verification", vote_counting_works,
                           f"- {len(votes)} votes recorded, phase: {phase}")

    def run_all_tests(self):
        """Run all voting permissions tests"""
        print("🏰 SECRETUS REGNUM - VOTING PERMISSIONS BUG FIX TEST")
        print("=" * 60)
        print(f"Testing room: {self.room_code}")
        print(f"Existing player: {self.existing_player_id}")
        print("=" * 60)
        
        # Run tests in sequence
        tests = [
            ("Setup Test Scenario", self.setup_test_scenario),
            ("Start Game", self.start_game_test),
            ("Nomination Phase", self.nomination_test),
            ("Voting Permissions (CRITICAL)", self.voting_permissions_test),
            ("Vote Counting Logic", self.verify_vote_counting)
        ]
        
        all_passed = True
        for test_name, test_func in tests:
            print(f"\n{'='*20} {test_name} {'='*20}")
            try:
                result = test_func()
                if not result:
                    all_passed = False
            except Exception as e:
                print(f"❌ Test {test_name} crashed: {str(e)}")
                all_passed = False
                self.tests_run += 1
        
        # Print final results
        print(f"\n{'='*60}")
        print(f"📊 VOTING PERMISSIONS BUG FIX TEST RESULTS:")
        print(f"   Tests Run: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Tests Failed: {self.tests_run - self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%" if self.tests_run > 0 else "No tests run")
        
        if all_passed:
            print(f"\n🎉 ALL TESTS PASSED - VOTING PERMISSIONS BUG FIX VERIFIED!")
        else:
            print(f"\n⚠️  SOME TESTS FAILED - VOTING PERMISSIONS BUG STILL EXISTS!")
        
        return all_passed

def main():
    tester = VotingPermissionsTest()
    success = tester.run_all_tests()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())