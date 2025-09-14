import React from 'react';
import { Vote, ThumbsUp, ThumbsDown, Clock, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Progress } from './ui/progress';

const VotePanel = ({ players, regentSeat, nomineeSeat, votes, myVote, mySeat, onVote }) => {
  const regent = players.find(p => p.seat === regentSeat);
  const nominee = players.find(p => p.seat === nomineeSeat);
  
  // Le gouvernement proposé ne peut pas voter
  const canIVote = mySeat !== regentSeat && mySeat !== nomineeSeat;
  
  const alivePlayers = players.filter(p => p.alive);
  const eligibleVoters = alivePlayers.filter(p => p.seat !== regentSeat && p.seat !== nomineeSeat);
  const totalVotes = Object.keys(votes).length;
  const votesNeeded = eligibleVoters.length;
  
  const yesVotes = Object.values(votes).filter(v => v === 'oui').length;
  const noVotes = Object.values(votes).filter(v => v === 'non').length;

  return (
    <Card className="bg-purple-50 border-purple-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Vote className="h-5 w-5 mr-2 text-purple-600" />
          Vote pour le Gouvernement
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Government Info */}
          <div className="bg-purple-100 p-4 rounded-lg">
            <h4 className="font-medium text-purple-900 mb-2">Gouvernement proposé :</h4>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="text-center">
                  <Badge variant="secondary" className="mb-1">Régent</Badge>
                  <p className="font-medium">{regent?.name}</p>
                  <p className="text-xs text-gray-600">Siège {regentSeat}</p>
                </div>
                <div className="text-center">
                  <Badge variant="secondary" className="mb-1">Chambellan</Badge>
                  <p className="font-medium">{nominee?.name}</p>
                  <p className="text-xs text-gray-600">Siège {nomineeSeat}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Vote Progress */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Progression du vote</span>
              <span className="text-sm text-gray-600">{totalVotes}/{votesNeeded}</span>
            </div>
            <Progress value={(totalVotes / votesNeeded) * 100} className="h-2" />
            
            <div className="flex justify-between text-sm">
              <span className="text-green-600">👍 OUI: {yesVotes}</span>
              <span className="text-red-600">👎 NON: {noVotes}</span>
            </div>
          </div>

          {/* Voting Buttons */}
          {!myVote ? (
            <div className="space-y-3">
              <p className="text-center font-medium text-purple-900">
                Votez pour ou contre ce gouvernement :
              </p>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={() => onVote('oui')}
                  className="bg-green-600 hover:bg-green-700 text-white h-12"
                >
                  <ThumbsUp className="h-5 w-5 mr-2" />
                  OUI
                </Button>
                <Button
                  onClick={() => onVote('non')}
                  className="bg-red-600 hover:bg-red-700 text-white h-12"
                >
                  <ThumbsDown className="h-5 w-5 mr-2" />
                  NON
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center p-4 bg-gray-100 rounded-lg">
              <p className="font-medium text-gray-800 mb-2">
                Votre vote : {myVote === 'oui' ? '👍 OUI' : '👎 NON'}
              </p>
              <p className="text-sm text-gray-600">
                En attente des autres joueurs...
              </p>
            </div>
          )}

          {/* Vote Status */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Clock className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-700">
                  {totalVotes < votesNeeded ? 'Vote en cours...' : 'Décompte des votes...'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4 text-gray-600" />
                <span className="text-sm text-gray-700">
                  {votesNeeded - totalVotes} vote(s) restant(s)
                </span>
              </div>
            </div>
          </div>

          {/* Voting Rules */}
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700">
              <strong>Règle :</strong> La majorité simple est requise. 
              En cas d'égalité, le gouvernement est rejeté.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VotePanel;