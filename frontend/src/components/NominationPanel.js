import React from 'react';
import { Crown, Users } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

const NominationPanel = ({ meSeat, regentSeat, players, prevGovernment, disgracedPlayerSeat, onNominate }) => {
  const isRegent = meSeat === regentSeat;
  
  if (!isRegent) {
    return (
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Crown className="h-5 w-5 mr-2 text-blue-600" />
            Phase de Nomination
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6">
            <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <p className="text-blue-800 text-lg mb-2">
              En attente de la nomination du Roi
            </p>
            <p className="text-blue-600 text-sm">
              Le Roi (Siège {regentSeat}) doit choisir un Conseiller
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Filter out invalid nominees
  const validCandidates = players.filter(player => {
    // Can't nominate self
    if (player.seat === regentSeat) return false;
    
    // Can't nominate dead players
    if (!player.alive) return false;
    
    // Can't nominate previous government members
    if (prevGovernment) {
      if (player.seat === prevGovernment.regent || player.seat === prevGovernment.chambellan) {
        return false;
      }
    }
    
    // Can't nominate disgraced player (Colère du Peuple)
    if (disgracedPlayerSeat && player.seat === disgracedPlayerSeat) {
      return false;
    }
    
    return true;
  });

  return (
    <Card className="bg-amber-50 border-amber-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Crown className="h-5 w-5 mr-2 text-amber-600" />
          Nomination du Conseiller
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="bg-amber-100 p-3 rounded-lg">
            <p className="text-amber-800 font-medium mb-2">
              👑 Vous êtes le Roi !
            </p>
            <p className="text-amber-700 text-sm">
              Choisissez un joueur pour être votre Conseiller. Ensemble, vous formerez le gouvernement.
            </p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-medium text-amber-900">Candidats disponibles :</h4>
            <div className="grid gap-2">
              {validCandidates.map(player => (
                <Button
                  key={player.seat}
                  onClick={() => onNominate(player.seat)}
                  variant="outline"
                  className="justify-start h-auto p-3 bg-white hover:bg-amber-100 border-amber-300"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-amber-200 flex items-center justify-center text-sm font-bold">
                      {player.seat}
                    </div>
                    <div className="text-left">
                      <p className="font-medium">{player.name}</p>
                      <p className="text-xs text-gray-600">Siège {player.seat}</p>
                    </div>
                  </div>
                </Button>
              ))}
            </div>
            
            {validCandidates.length === 0 && (
              <div className="text-center p-4 bg-red-100 rounded-lg">
                <p className="text-red-800">Aucun candidat disponible</p>
                <p className="text-red-600 text-sm">Tous les joueurs éligibles ont été exclus</p>
              </div>
            )}
          </div>
          
          {prevGovernment && (
            <div className="bg-gray-100 p-3 rounded-lg">
              <p className="text-gray-700 text-sm">
                <strong>Gouvernement précédent :</strong> Roi (Siège {prevGovernment.regent}), 
                Conseiller (Siège {prevGovernment.chambellan}) - Exclus de la nomination
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default NominationPanel;