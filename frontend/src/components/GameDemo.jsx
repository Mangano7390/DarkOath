import React, { useState } from 'react';
import Board from './Board';
import DecreeCard from './DecreeCard';
import RoleCard from './RoleCard';
import VoteToken from './VoteToken';
import GovPlacard from './GovPlacard';
import { CrisisToken, DecreeMarker, TurnMarker, PowerToken, Slot } from './Tokens';
import { colors } from '../lib/theme';
import '../styles/cards.css';

export default function GameDemo() {
  const [loyalCount, setLoyalCount] = useState(2);
  const [conjureCount, setConjureCount] = useState(3);
  const [crisis, setCrisis] = useState(1);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-900 via-amber-800 to-orange-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-amber-100 mb-4 text-medieval">
            🏰 Secretus Regnum - Composants de Jeu
          </h1>
          <p className="text-amber-200 text-lg">
            Démonstration des composants visuels avec SVG inline
          </p>
        </div>

        {/* Board Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-amber-100 text-medieval">Plateau de Jeu</h2>
          <div className="flex justify-center">
            <Board 
              loyalCount={loyalCount}
              conjureCount={conjureCount}
              crisis={crisis}
              width={1000}
              onSlotClick={(type, index) => {
                console.log(`Clicked ${type} slot ${index}`);
                if (type === 'loyal' && loyalCount < 5) {
                  setLoyalCount(prev => Math.min(5, prev + 1));
                } else if (type === 'conjure' && conjureCount < 6) {
                  setConjureCount(prev => Math.min(6, prev + 1));
                }
              }}
            />
          </div>
          
          {/* Board Controls */}
          <div className="flex justify-center space-x-4">
            <button 
              onClick={() => setLoyalCount(prev => Math.max(0, prev - 1))}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Loyal -
            </button>
            <button 
              onClick={() => setLoyalCount(prev => Math.min(5, prev + 1))}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Loyal +
            </button>
            <button 
              onClick={() => setConjureCount(prev => Math.max(0, prev - 1))}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Conjuré -
            </button>
            <button 
              onClick={() => setConjureCount(prev => Math.min(6, prev + 1))}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Conjuré +
            </button>
            <button 
              onClick={() => setCrisis(prev => ((prev + 1) % 4))}
              className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700"
            >
              Crise: {crisis}
            </button>
          </div>
        </section>

        {/* Cards Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-amber-100 text-medieval">Cartes</h2>
          
          {/* Decree Cards */}
          <div>
            <h3 className="text-xl text-amber-200 mb-3">Cartes Décrets</h3>
            <div className="flex justify-center space-x-6">
              <DecreeCard type="loyal" />
              <DecreeCard type="conjure" />
            </div>
          </div>
          
          {/* Role Cards */}
          <div>
            <h3 className="text-xl text-amber-200 mb-3">Cartes Rôles</h3>
            <div className="flex justify-center space-x-6">
              <RoleCard type="LOYAL" />
              <RoleCard type="CONJURE" />
              <RoleCard type="USURPATEUR" />
              <RoleCard type="LOYAL" revealed={false} />
            </div>
          </div>
        </section>

        {/* Tokens Section */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-amber-100 text-medieval">Tokens & Éléments</h2>
          
          {/* Vote Tokens */}
          <div>
            <h3 className="text-xl text-amber-200 mb-3">Jetons de Vote</h3>
            <div className="flex justify-center space-x-6">
              <VoteToken type="oui" size="small" />
              <VoteToken type="oui" size="medium" />
              <VoteToken type="oui" size="large" />
              <VoteToken type="non" size="small" />
              <VoteToken type="non" size="medium" />
              <VoteToken type="non" size="large" />
            </div>
          </div>
          
          {/* Government Placards */}
          <div>
            <h3 className="text-xl text-amber-200 mb-3">Plaques Gouvernement</h3>
            <div className="flex justify-center space-x-6">
              <GovPlacard role="regent" playerName="Alice Chevalier" active={true} />
              <GovPlacard role="chambellan" playerName="Bob Conjuré" />
            </div>
          </div>
          
          {/* Various Tokens */}
          <div>
            <h3 className="text-xl text-amber-200 mb-3">Jetons Divers</h3>
            <div className="flex justify-center items-center space-x-8">
              <div className="text-center space-y-2">
                <CrisisToken level={0} />
                <p className="text-amber-200 text-sm">Crise 0</p>
              </div>
              <div className="text-center space-y-2">
                <CrisisToken level={1} />
                <p className="text-amber-200 text-sm">Crise 1</p>
              </div>
              <div className="text-center space-y-2">
                <CrisisToken level={2} />
                <p className="text-amber-200 text-sm">Crise 2</p>
              </div>
              <div className="text-center space-y-2">
                <CrisisToken level={3} />
                <p className="text-amber-200 text-sm">Crise 3</p>
              </div>
              <div className="text-center space-y-2">
                <TurnMarker pointing="right" />
                <p className="text-amber-200 text-sm">Tour</p>
              </div>
            </div>
          </div>
          
          {/* Power Tokens */}
          <div>
            <h3 className="text-xl text-amber-200 mb-3">Pouvoirs</h3>
            <div className="flex justify-center items-center space-x-8">
              <div className="text-center space-y-2">
                <PowerToken type="investigation" unlocked={true} />
                <p className="text-amber-200 text-sm">Investigation</p>
              </div>
              <div className="text-center space-y-2">
                <PowerToken type="execution" unlocked={true} />
                <p className="text-amber-200 text-sm">Exécution</p>
              </div>
              <div className="text-center space-y-2">
                <PowerToken type="special_election" unlocked={false} />
                <p className="text-amber-200 text-sm">Élection</p>
              </div>
            </div>
          </div>
          
          {/* Decree Markers */}
          <div>
            <h3 className="text-xl text-amber-200 mb-3">Marqueurs de Piste</h3>
            <div className="flex justify-center items-center space-x-4">
              <DecreeMarker type="loyal" position={1} active={true} />
              <DecreeMarker type="loyal" position={2} active={false} />
              <DecreeMarker type="conjure" position={1} active={true} />
              <DecreeMarker type="conjure" position={2} active={false} />
            </div>
          </div>
          
          {/* Slots */}
          <div>
            <h3 className="text-xl text-amber-200 mb-3">Emplacements</h3>
            <div className="flex justify-center items-center space-x-4">
              <Slot type="loyal" filled={true} index={1} />
              <Slot type="loyal" filled={false} index={2} />
              <Slot type="conjure" filled={true} index={1} />
              <Slot type="conjure" filled={false} index={2} />
            </div>
          </div>
        </section>

        {/* Color Palette */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-amber-100 text-medieval">Palette de Couleurs</h2>
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(colors).map(([name, color]) => (
              <div key={name} className="text-center">
                <div 
                  className="w-16 h-16 rounded-lg mx-auto mb-2 border border-amber-200"
                  style={{ backgroundColor: color }}
                />
                <p className="text-amber-200 text-sm">{name}</p>
                <p className="text-amber-300 text-xs font-mono">{color}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <div className="text-center py-12">
          <p className="text-amber-300">
            🎨 Tous les composants utilisent uniquement des SVG inline - aucune image externe requise
          </p>
          <p className="text-amber-400 text-sm mt-2">
            Prêt pour l'intégration dans Secretus Regnum !
          </p>
        </div>
      </div>
    </div>
  );
}