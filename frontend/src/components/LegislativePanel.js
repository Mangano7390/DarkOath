import React from 'react';
import { Gavel, FileText, Eye, Clock } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';

const LegislativePanel = ({ phase, mySeat, regentSeat, chambellanSeat, players, cards, onDiscard }) => {
  const isRegent = mySeat === regentSeat;
  const isChancelier = mySeat === chambellanSeat;
  const isActivePlayer = (phase === 'LEGIS_REGENT' && isRegent) || (phase === 'LEGIS_CHAMBELLAN' && isChancelier);
  
  const regent = players.find(p => p.seat === regentSeat);
  const chambellan = players.find(p => p.seat === chambellanSeat);
  
  const getPhaseTitle = () => {
    switch(phase) {
      case 'LEGIS_REGENT':
        return 'Session Législative - Roi';
      case 'LEGIS_CHAMBELLAN':
        return 'Session Législative - Chancelier';
      default:
        return 'Session Législative';
    }
  };
  
  const getPhaseDescription = () => {
    switch(phase) {
      case 'LEGIS_REGENT':
        return isRegent 
          ? 'Vous devez défausser une carte et passer les 2 restantes au Chancelier'
          : `Le Roi (${regent?.name}) examine 3 cartes et en défausse une`;
      case 'LEGIS_CHAMBELLAN':
        return isChancelier
          ? 'Choisissez une carte à adopter et défaussez l\'autre'
          : `Le Chancelier (${chambellan?.name}) choisit la carte à adopter`;
      default:
        return 'Session législative en cours';
    }
  };

  if (!isActivePlayer) {
    return (
      <Card className="bg-amber-50 border-amber-200">
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <Gavel className="h-5 w-5 mr-2 text-amber-600" />
            {getPhaseTitle()}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6">
            <Clock className="h-12 w-12 text-amber-600 mx-auto mb-4" />
            <p className="text-amber-800 text-lg mb-2">
              En attente de la décision
            </p>
            <p className="text-amber-600 text-sm">
              {getPhaseDescription()}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-amber-50 border-amber-200">
      <CardHeader>
        <CardTitle className="text-lg flex items-center">
          <Gavel className="h-5 w-5 mr-2 text-amber-600" />
          {getPhaseTitle()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Role Info */}
          <div className="bg-amber-100 p-3 rounded-lg">
            <p className="text-amber-800 font-medium mb-2">
              {phase === 'LEGIS_REGENT' ? '👑 Vous êtes le Roi' : '🏛️ Vous êtes le Chancelier'}
            </p>
            <p className="text-amber-700 text-sm">
              {getPhaseDescription()}
            </p>
          </div>

          {/* Cards Section */}
          <div className="space-y-3">
            <h4 className="font-medium text-amber-900 flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              {phase === 'LEGIS_REGENT' ? 'Cartes tirées (défaussez-en 1)' : 'Cartes reçues (adoptez-en 1)'}
            </h4>
            
            {cards && cards.length > 0 ? (
              <div className="grid gap-3">
                {cards.map((card, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-300">
                    <div className="flex items-center space-x-3">
                      <div className={`w-4 h-4 rounded-full ${
                        card === 'LOYAL' ? 'bg-blue-500' : 'bg-red-500'
                      }`} />
                      <span className="font-medium">
                        {card === 'LOYAL' ? 'Décret Loyal' : 'Décret de Trahison'}
                      </span>
                    </div>
                    <Button
                      onClick={() => onDiscard(index)}
                      variant="outline"
                      size="sm"
                      className="text-amber-700 border-amber-300 hover:bg-amber-100"
                    >
                      {phase === 'LEGIS_REGENT' ? 'Défausser' : 'Adopter'}
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center p-6 bg-gray-100 rounded-lg">
                <Eye className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-600">
                  En attente des cartes...
                </p>
                <p className="text-gray-500 text-sm">
                  Les cartes seront distribuées automatiquement
                </p>
              </div>
            )}
          </div>

          {/* Government Info */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h5 className="font-medium text-gray-800 mb-2">Gouvernement actuel :</h5>
            <div className="flex items-center space-x-4">
              <div className="text-center">
                <Badge variant="secondary" className="mb-1">Roi</Badge>
                <p className="text-sm font-medium">{regent?.name}</p>
                <p className="text-xs text-gray-600">Siège {regentSeat}</p>
              </div>
              <div className="text-center">
                <Badge variant="secondary" className="mb-1">Chancelier</Badge>
                <p className="text-sm font-medium">{chambellan?.name}</p>
                <p className="text-xs text-gray-600">Siège {chambellanSeat}</p>
              </div>
            </div>
          </div>

          {/* Rules */}
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-xs text-blue-700">
              <strong>Règle :</strong> {phase === 'LEGIS_REGENT' 
                ? 'Le Roi tire 3 cartes, en défausse 1 secrètement, et passe les 2 restantes au Chancelier.'
                : 'Le Chancelier reçoit 2 cartes du Roi, en adopte 1, et défausse l\'autre secrètement.'
              }
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LegislativePanel;