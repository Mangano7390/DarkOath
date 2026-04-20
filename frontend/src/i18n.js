import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  fr: {
    translation: {
      subtitle: "Un jeu de déduction sociale médiéval",
      
      gameDescription: {
        title: "À propos du jeu",
        text: "Dans Secretus Regnum, incarnez un noble dans un royaume en péril. Les Fidèles tentent de préserver la stabilité du royaume, tandis que les Traîtres et leur mystérieux Tyran conspirent pour prendre le pouvoir. Qui pouvez-vous faire confiance ?"
      },
      
      roles: {
        loyal: "Fidèles",
        loyalDesc: "Défendez le royaume et démasquez les traîtres",
        conjure: "Traîtres",
        conjureDesc: "Répandez le chaos et aidez l'Tyran",
        tyran: "Tyran",
        usurpateurDesc: "Prenez le pouvoir en secret"
      },
      
      actions: {
        createRoom: "Créer une salle",
        joinRoom: "Rejoindre une salle",
        readRules: "Lire les règles"
      },
      
      form: {
        playerName: "Votre nom",
        playerNamePlaceholder: "Entrez votre nom...",
        roomCode: "Code de la salle"
      },
      
      lobby: {
        title: "Salon d'attente",
        code: "Code",
        players: "joueurs",
        playersList: "Liste des joueurs",
        waitingPlayer: "En attente d'un joueur...",
        connected: "Connecté",
        disconnected: "Déconnecté",
        startGame: "Commencer la partie",
        waitingForPlayers: "En attente de {{needed}} joueur(s) supplémentaire(s)"
      },
      
      game: {
        title: "Partie en cours",
        comingSoon: "Interface de jeu en développement...",
        
        // New game interface translations
        phases: {
          nomination: "Nomination du Chambellan",
          vote: "Vote pour le gouvernement", 
          legis_regent: "Session législative - Roi",
          legis_chambellan: "Session législative - Chambellan",
          power: "Pouvoir du Roi"
        },
        
        roles: {
          loyal: "Fidèle",
          conjure: "Traître", 
          tyran: "Tyran"
        },
        
        actions: {
          nominate: "Nominer",
          vote: "Voter",
          yes: "Oui",
          no: "Non",
          investigate: "Investigation",
          execute: "Exécution",
          specialElection: "Élection Spéciale"
        }
      }
    }
  },
  en: {
    translation: {
      subtitle: "A medieval social deduction game",
      
      gameDescription: {
        title: "About the game",
        text: "In Secretus Regnum, play as a noble in a kingdom in peril. Loyal Knights try to preserve the kingdom's stability, while Conspirators and their mysterious Usurper plot to seize power. Who can you trust?"
      },
      
      roles: {
        loyal: "Loyal Knights",  
        loyalDesc: "Defend the kingdom and unmask traitors",
        conjure: "Conspirators",
        conjureDesc: "Spread chaos and help the Usurper",
        tyran: "Usurper",
        usurpateurDesc: "Seize power in secret"
      },
      
      actions: {
        createRoom: "Create Room",
        joinRoom: "Join Room", 
        readRules: "Read Rules"
      },
      
      form: {
        playerName: "Your name",
        playerNamePlaceholder: "Enter your name...",
        roomCode: "Room code"
      },
      
      lobby: {
        title: "Lobby",
        code: "Code", 
        players: "players",
        playersList: "Players list",
        waitingPlayer: "Waiting for player...",
        connected: "Connected",
        disconnected: "Disconnected", 
        startGame: "Start Game",
        waitingForPlayers: "Waiting for {{needed}} more player(s)"
      },
      
      game: {
        title: "Game in Progress",
        comingSoon: "Game interface in development...",
        
        // New game interface translations
        phases: {
          nomination: "Chancellor Nomination",
          vote: "Government Vote",
          legis_regent: "Legislative Session - Regent", 
          legis_chambellan: "Legislative Session - Chancellor",
          power: "Regent Power"
        },
        
        roles: {
          loyal: "Loyal Knight",
          conjure: "Conspirator",
          tyran: "Usurper"
        },
        
        actions: {
          nominate: "Nominate",
          vote: "Vote", 
          yes: "Yes",
          no: "No",
          investigate: "Investigation",
          execute: "Execution", 
          specialElection: "Special Election"
        }
      }
    }
  }
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'fr',
    fallbackLng: 'fr',
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;