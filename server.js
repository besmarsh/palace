// Dependencies
var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
var app = express();
var server = http.Server(app);
var io = socketIO(server);
app.set('port', 5000);
app.use('/static', express.static(__dirname + '/static'));
// Routing
app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, 'index.html'));
});
// Starts the server.
server.listen(5000, function() {
  console.log('Starting server on port 5000');
});

//Creates a deck (array) of Cards, and returns the deck
function createDeck() {
  deck = [];
  suits = ["C", "D", "H", "S"];
  numbers = [2, 3, 4, 5, 6, 7, 8, 9, 10, "J", "Q", "K", "A"];
  for (number = 0; number < 13; number ++) {
    for (suit = 0; suit < 4; suit ++) {
      image_name = numbers[number] + suits[suit]
      deck.push(new Card(numbers[number], suits[suit], image_name));
    };
  };
  deck.push(new Card("Joker", "BW", "BWJoker"));
  deck.push(new Card("Joker", "Color", "ColorJoker"));
  return deck;
}
//Shuffles a deck using the Fisher-Yates shuffle algorithm
function shuffleDeck(deck) {
  for (i = deck.length - 1; i > 0; i--) {
    j = Math.floor(Math.random() * (i + 1));
    temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  };
  return deck;
};
//Takes a card and formats it, returning the card in number-suit form, and just the card number itself
function formatCard(selectedCard) {
  var cardPlayed = selectedCard.split('\\').pop().split('/').pop();
  if (cardPlayed.slice(-4) == '.png') {
    cardPlayed = cardPlayed.slice(0, -4);
  };
  if (cardPlayed != "BWJoker" && cardPlayed != "ColorJoker") {
    var cardNumberPlayed = cardPlayed.slice(0, -1);
    //Try to assign numeric value
    var cardNumberPlayedAsNumber = Number(cardNumberPlayed);
    //Will return NaN for non-numeric cards, so use the card number map for these
    //!== used to check for NaN, as only NaN types are unequal to themselves
    if (cardNumberPlayedAsNumber !== cardNumberPlayedAsNumber) {
      cardNumberPlayed = cardLetterToNumberMap[cardNumberPlayed];
    } else {
      cardNumberPlayed = cardNumberPlayedAsNumber;
    }
  } else {
    var cardNumberPlayed = null;
  };
  return [cardPlayed, cardNumberPlayed];
}

class Player {
  constructor(socket, id, playerNumber) {
    this.socket = socket;
    this.id = id;
    this.playerNumber = playerNumber;
    this.playerName;
    this.downCards = [];
    this.upCards = [];
    this.hand = [];
    this.readyToPlay = false;
    this.swapped = false;
    this.playAgain = false;
  }
  setPlayerName(playerName) {
    this.playerName = playerName;
  }
  allDownCardsNull() {
    var allNull = true;
    for (let i = 0; i < this.downCards.length; i++) {
      if (this.downCards[i] != null) {
        allNull = false;
        break;
      };
    };
    return allNull;
  }
  // Function to allow players to swap cards in their hands with their up cards
  swapCards(game, hand, upCards) {
    this.swapped = true;
    var newHand = []
    var newUpCards = []
    //For each card in a player's hand
    for (let i = 0; i < hand.length; i++) {
      //Trim data sent from client
      var handCard = hand[i].split('\\').pop().split('/').pop();
      handCard = handCard.slice(0, -4);
      var upCard = upCards[i].split('\\').pop().split('/').pop();
      upCard = upCard.slice(0, -4);

      //Assign cards according to swaps made
      for (let j = 0; j < hand.length;  j++) {
        if (handCard == this.hand[j].image_name) {
          newHand.push(this.hand[j]);
        } else if (handCard == this.upCards[j].image_name) {
          newHand.push(this.upCards[j]);
        };
        if (upCard == this.upCards[j].image_name) {
          newUpCards.push(this.upCards[j]);
        } else if (upCard == this.hand[j].image_name) {
          newUpCards.push(this.hand[j]);
        };
      };
    };
    //Set new arrays
    this.hand = newHand;
    this.upCards = newUpCards;

    //Test if all players have swapped their cards
    var allSwapped = true;
    for (let i = 0; i < game.players.length; i++) {
      if (game.players[i].swapped == false) {
        allSwapped = false;
        break;
      };
    };
    //When all players have swapped their cards
    if (allSwapped) {
      io.to('game_room').emit('disablecardswaps', game.numberOfCards);
      game.sendInitialisedCardsToPlayers();
      game.state = "inGame";
      game.chooseFirstPlayer();
    };
  }
}

class Card {
  constructor(number, suit, image_name) {
    this.number = number;
    this.suit = suit;
    this.image_name = image_name
  }
}

class Direction {
  constructor(direction) {
    this.direction = direction;
  }
  switchDirection() {
    if (this.direction == "CLOCKWISE") {
      this.direction = "ANTICLOCKWISE";
    } else {
      this.direction = "CLOCKWISE";
    };
  }
}

const cardLetterToNumberMap = {
  "J": 11, "Q": 12, "K": 13, "A": 14
};

const cardNumberToNameMap = {
  11: "Jack", 12: "Queen", 13: "King", 14: "Ace"
};

class Game {
  constructor() {
    this.players;
    this.opponentPlayers = [];
    this.numberOfCards;
    this.playerTurn;
    this.playerTurnIndex;
    this.deck;
    this.activeDeck = [];
    this.isFirstGame = true;
    this.previousGameWinner;
    this.playerNames;
    this.direction_of_play = new Direction("CLOCKWISE");
    this.state = "beforeGame";
  }
  reset() {
    this.opponentPlayers = [];
    this.activeDeck = [];
  }
  //Checks if the game has ended, and if so broadcasts this, and creates listeners for a new game to start
  checkGameEnd() {
    io.to('game_room').emit('log', 'checkGameEnd');

    //If the player has no cards in their hand, no upCards, and no downCards, they win
    if (this.playerTurn.hand.length == 0 && this.playerTurn.upCards.length == 0 && this.playerTurn.allDownCardsNull()) {
      this.playerTurn.socket.emit('gameend', 'win');
      this.playerTurn.socket.broadcast.emit('gameend', 'lose');

      //Callback function for starting a new game to avoid closure issue
      function callBack(i) {
        return function() {
          //Decide if all players have chosen to play again
          this.players[i].playAgain = true;
          var allPlayAgain = true;
          for (let i = 0; i < this.players.length; i++) {
            if (this.players[i].playAgain == false) {
              allPlayAgain = false;
              break;
            };
          };
          //When all players choose to play again, initialise a new game
          if (allPlayAgain) {
            io.to('game_room').emit('recreatecards');
            var newPlayerArray = [];
            for (let i = 0; i < this.players.length; i++) {
              newPlayerArray.push(new Player(this.players[i].socket, this.players[i].id, this.players[i].playerNumber));
            };
            //Reset necessary game variables
            this.isFirstGame = false;
            this.previousGameWinner = playerTurn;
            this.players = newPlayerArray;
            this.direction_of_play.direction = "CLOCKWISE";
            this.initialiseGame();
          };
        };
      };

      //Create listeners for each client opting to start a new game, using callback function to avoid closure issue
      for (let i = 0; i < this.players.length; i++ ){
        this.players[i].socket.on('newgame', callBack(i));
      };
      //Return true if the game has ended, false if not
      return true;
    } else {
      return false;
    };
  }
  //Sends all players the cards they need initially, with informations for the clients to display them correctly
  sendInitialisedCardsToPlayers() {
    //For each player, create array of opponents' upCards, and send each player only the cards they need
    for (let i = 0; i < this.players.length; i++) {
      var opponentUpCards = [];
      for (let j = 0; j < this.players.length; j++) {
        if (j+1 != this.players[i].playerNumber) {
          opponentUpCards.push(this.players[j].upCards);
        };
      };
      this.players[i].socket.emit('initialisecards', this.players[i].upCards, this.players[i].hand, opponentUpCards, this.players.length, this.numberOfCards, this.players[i].playerNumber);
    };
  }
  //Pushes all the cards on the activeDeck onto the current player's hand
  pickUpCards() {
    for (let i = 0; i < this.activeDeck.length; i++) {
      this.playerTurn.hand.push(this.activeDeck[i]);
    };
    this.activeDeck = [];
  }
  //Give the next turn to the next player clockwise (right/i+1 in array)
  switchPlayerClockwise() {
    io.to('game_room').emit('log', 'switchPlayerClockwise');
    //Update players array with modified playerTurn from the turn just played
    this.players[this.playerTurnIndex] = this.playerTurn;
    //Remove the next player to play from the opponents array, add in the player who has just played, update playerTurnIndex to the next player
    if (this.playerTurn.playerNumber == this.opponentPlayers.length) {
      var opponentIndexToRemove = 0;
      this.opponentPlayers[opponentIndexToRemove] = null;
      this.opponentPlayers[this.opponentPlayers.length-1] = this.playerTurn;
      this.playerTurnIndex = 0;
    } else {
      var opponentIndexToRemove = this.playerTurn.playerNumber;
      this.opponentPlayers[opponentIndexToRemove] = null;
      this.opponentPlayers[opponentIndexToRemove-1] = this.playerTurn;
      this.playerTurnIndex++;
    };
    //Increment the playerTurnIndex and update playerTurn to the next player to play
    this.playerTurn = this.players[this.playerTurnIndex];
  }
  //Give the next turn to the next player anticlockwise (left/i-1 in array)
  switchPlayerAntiClockwise() {
    io.to('game_room').emit('log', 'switchPlayerAntiClockwise');
    //Update players array with modified playerTurn from the turn just played
    this.players[this.playerTurnIndex] = this.playerTurn;
    //Remove the previous player to play from the opponents array, add in the player who has just played, update playerTurnIndex to the previous player
    //Based closely on switchPlayerClockwise above.
    if (this.playerTurn.playerNumber == 1) {
      var opponentIndexToRemove = this.opponentPlayers.length-1;
      this.opponentPlayers[opponentIndexToRemove] = null;
      this.opponentPlayers[0] = this.playerTurn;
      this.playerTurnIndex = this.players.length-1;
    } else {
      var opponentIndexToRemove = this.playerTurn.playerNumber-2;
      this.opponentPlayers[opponentIndexToRemove] = null;
      this.opponentPlayers[this.playerTurn.playerNumber-1] = this.playerTurn;
      this.playerTurnIndex--;
    };
    //Increment the playerTurnIndex and update playerTurn to the next player to play
    this.playerTurn = this.players[this.playerTurnIndex];
  }
  //Gets the number of the card on top of the activeDeck
  getActiveDeckCardNumber() {
    var activeCard = this.activeDeck[this.activeDeck.length-1].number;
    //If the active card is a Joker, get the card below the Joker in the active deck
    if (activeCard == "Joker") {
      if (this.activeDeck[this.activeDeck.length-2]) {
        activeCard = this.activeDeck[this.activeDeck.length-2].number;
      } else {
        activeCard = this.activeDeck[this.activeDeck.length-1].image_name;
      };
      //If that card is a Joker again, get the card below that
      if (activeCard == "Joker") {
        if (this.activeDeck[this.activeDeck.length-3]) {
          activeCard = this.activeDeck[this.activeDeck.length-3].number;
        } else {
          activeCard = this.activeDeck[this.activeDeck.length-2].image_name;
        };
      };
    };
    //Try to assign numeric value
    var activeCardAsNumber = Number(activeCard);
    //Will return NaN for non-numeric cards, so use the card number map for these
    //!== used to check for NaN, as only NaN types are unequal to themselves
    //If the card is a Joker, leave it as it is
    if ((activeCardAsNumber !== activeCardAsNumber) && activeCard != "BWJoker" && activeCard != "ColorJoker") {
      activeCard = cardLetterToNumberMap[activeCard];
    } else if (activeCard != "BWJoker" && activeCard != "ColorJoker") {
      activeCard = activeCardAsNumber;
    }
    return activeCard;
  }
  //Finds the card that a player has played, and pushes it onto the activeDeck
  findAndPushCard(setOfCards, cardPlayed) {
    //Find the card the player played. Search depending on where the card was played from
    if (setOfCards == 'hand') {
      for (let i = 0; i < this.playerTurn.hand.length; i++) {
        if (this.playerTurn.hand[i].image_name == cardPlayed) {
          //Use the position of that card to remove it from their hand and push it onto the active deck
          this.activeDeck.push(this.playerTurn.hand.splice(i, 1)[0]);
          break;
        };
      };
    } else if (setOfCards == 'upCards') {
      for (let i = 0; i < this.playerTurn.upCards.length; i++) {
        if (this.playerTurn.upCards[i].image_name == cardPlayed) {
          //Use the position of that card to remove it from their hand and push it onto the active deck
          this.activeDeck.push(this.playerTurn.upCards.splice(i, 1)[0]);
          break;
        };
      };
    } else if (setOfCards == 'downCards') {
      for (let i = 0; i < this.playerTurn.downCards.length; i++) {
        if (this.playerTurn.downCards[i] != null) {
          if (this.playerTurn.downCards[i].image_name == cardPlayed) {
            //Use the position of that card to remove it from their hand and push it onto the active deck
            //Note: Whereas hand cards and upCards can be spliced, downCards must be set to null. This is because when
            //the client sends hand cards and upCards it can send the card to the server, but as the client doesn't
            //know what a player's downCards are, they are sent by index chosen, therefore structure and length of the
            //downCards array must be maintained; downCards must keep the same position in their array.
            this.activeDeck.push(this.playerTurn.downCards[i]);
            this.playerTurn.downCards[i] = null;
            break;
          };
        };
      };
    };
  }
  //Pushes a card from the deck onto the current player's hand
  pickUpCard() {
    //If there are cards left to pick up, remove one from the deck and put it in the player's hand
    if (this.deck.length > 0 && this.playerTurn.hand.length < this.numberOfCards) {
      this.playerTurn.hand.push(this.deck.pop());
    };
  }
  //Checks if four cards of the same number have been played consecutively, and burns the activeDeck if so
  checkConsecutiveBurn() {
    //If all four suits of a card number are on the active deck consecutively, burn the active deck
    var consecBurn = false;
    if (this.activeDeck.length >= 4) {
      if (this.activeDeck[this.activeDeck.length - 1].number == this.activeDeck[this.activeDeck.length - 2].number
          && this.activeDeck[this.activeDeck.length - 1].number == this.activeDeck[this.activeDeck.length - 3].number
          && this.activeDeck[this.activeDeck.length - 1].number == this.activeDeck[this.activeDeck.length - 4].number) {
            this.activeDeck = [];
            consecBurn = true;
      };
    };
    return consecBurn;
  }
  //Function for resetting and deep copying the players array for the opponentPlayers array and setting the current player to null
  createOpponentArray(index) {
    this.opponentPlayers = [];
    for (let i = 0; i < this.players.length; i++) {
      this.opponentPlayers.push(this.players[i]);
    };
    this.opponentPlayers[index] = null;
  }
  //Checks the legality of a move, returns true if legal, false otherwise
  checkMoveLegality(activeCard, cardsPlayed, cardNumberPlayed) {
    var legal = false;
    if (this.activeDeck.length == 0 || cardNumberPlayed == 3) {
      legal = true;
    } else if (activeCard != 3) {
      if (cardNumberPlayed == 2 || cardNumberPlayed == 3 || cardNumberPlayed == 10) {
        legal = true;
      } else if (cardsPlayed[0] == "BWJoker" || cardsPlayed[0] == "ColorJoker") {
        legal = true;
      } else if (cardNumberPlayed >= activeCard) {
        legal = true;
      //If the activeCard is a Joker, the program sets the activeCard to the card beneath it, unless there is no card beneath it.
      //Because this is the only situation where the activeCard remains as a Joker, it can be assumed that any move played on an activeCard
      //of Joker is legal
      } else if (activeCard == "BWJoker" || activeCard == "ColorJoker") {
        legal = true;
      };
    }
    return legal;
  }
//Creates and returns both a message for the player who just played, and a message for all the other players
  commentaryForCardsPlayed(cardsPlayed, cardNumberPlayed, consecBurn) {
    //Get card names for picture cards/ace, add plural ending if multiple cards played
    if (cardNumberPlayed > 10) {
      var card = cardNumberToNameMap[cardNumberPlayed];
      if (cardsPlayed.length > 1) {
        card += 's';
      }
    } else {
      var card = cardNumberPlayed;
      if (cardsPlayed.length > 1) {
        card += '\'s';
      }
    }

    //Add message endings
    if (consecBurn == true || cardNumberPlayed == 10) {
      var end = ' and burned the deck';
    } else if (cardNumberPlayed == 2) {
      var end = ' and lowered the deck';
    } else {
      var end = '';
    }

    //Create message
    var message = [];
    //One card played
    if (cardsPlayed.length == 1) {
      if (cardsPlayed[0] == "BWJoker" || cardsPlayed[0] == "ColorJoker") {
        message[0] = 'You played a Joker and reversed the direction of play';
        message[1] = 'Opponent played a Joker and reversed the direction of play';
      } else if (cardNumberPlayed == 8 || cardNumberPlayed == 14) {
        message[0] = 'You played an ' + card + end;
        message[1] = 'Opponent played an ' + card + end;
      } else {
        message[0] = 'You played a ' + card + end;
        message[1] = 'Opponent played a ' + card + end;
      };

    //Multiple cards played
    } else {
      if (cardsPlayed[0] == "BWJoker" || cardsPlayed[0] == "ColorJoker") {
        message[0] = 'You played two Jokers';
        message[1] = 'Opponent played two Jokers';
      } else {
        message[0] = 'You played ' + (cardsPlayed.length) + ' ' + card + end;
        message[1] = 'Opponent played ' + (cardsPlayed.length) + ' ' + card + end;
      };
    };
    return message;
  }
  //Main method for executing a player's turn
  playTurn(selectedCards, setOfCards) {

    io.to('game_room').emit('log', 'playTurn');
    //Assign the current player
    this.playerTurn = this.players[this.playerTurnIndex];
  
    //If the player needs to pick up
    if (selectedCards == 'pickup') {
      this.pickUpCards();
      //Add the new hand cards
      this.playerTurn.socket.emit('addnewhandcards', this.playerTurn.hand);
      //Update the game interface
      this.playerTurn.socket.emit('updategameinterface', this.playerTurn.hand, this.playerTurn.upCards);
      this.playerTurn.socket.emit('gamecommentary', 'You picked up');
      this.playerTurn.socket.broadcast.emit('gamecommentary', 'Opponent picked up');
      //Set playerTurn to the previous player
      if (this.direction_of_play.direction == "CLOCKWISE") {
        this.switchPlayerAntiClockwise();
      } else {
        this.switchPlayerClockwise();
      }

    //If the player does not need to pick up, ie has played a card
    } else {
      //If the player played a downCard, get the card from the downCards array by the index sent from the client
      if (setOfCards == 'downCards') {
        console.log(selectedCards[0])
        console.log(this.playerTurn.downCards)
        var cardPlayed = this.playerTurn.downCards[selectedCards[0]].image_name;
      };
      //Format the cards, and push the cards onto a new array
      var cardsPlayed = [];
      var cardNumbersPlayed = [];
      //If a downCard was played, use the array position sent to retrieve the card
      if (setOfCards == 'downCards') {
        var downCardPosition = selectedCards[0];
        selectedCards[0] = this.playerTurn.downCards[selectedCards[0]].image_name;
      }
      for (let i = 0; i < selectedCards.length; i++) {
        var returnValue = formatCard(selectedCards[i]);
        var card = returnValue[0];
        var cardNumber = returnValue[1];
        cardsPlayed.push(card);
        cardNumbersPlayed.push(cardNumber);
      };
      //loop through all the card numbers played
      var legal = true;
      for (let i = 0; i < cardNumbersPlayed.length; i++) {
        //if a card's number isn't the same as the first card's number
        if (cardNumbersPlayed[i] != cardNumbersPlayed[0]) {
          //and the cards aren't jokers
          if (cardsPlayed.length == 2 && (cardsPlayed[0] == "BWJoker" && cardsPlayed[1] == "ColorJoker") || (cardsPlayed[0] == "ColorJoker" && cardsPlayed[1] == "BWJoker")) {
            break;
          } else {
            //tell the player the move was not legal and set legal to false so the gameplay logic is not executed
            legal = false;
            this.playerTurn.socket.emit('updateusermessagebox', "Illegal move");
            this.gamePlay();
            return;
          };
        };
      };
      if (legal) {
        //Assign the common card number played
        var cardNumberPlayed = cardNumbersPlayed[0];
        //Assign the activeCard
        if (this.activeDeck.length != 0) {
          var activeCard = this.getActiveDeckCardNumber();
        } else {
          var activeCard = null;
        };

        legal = this.checkMoveLegality(activeCard, cardsPlayed, cardNumberPlayed);

        //If the move was not legal
        if (!legal) {
          //If the player played a downCard and it wasn't a legal move, make them pick up
          if (setOfCards == 'downCards') {
            this.findAndPushCard(setOfCards, cardsPlayed[0]);
            this.pickUpCards();
            //Add the new hand cards
            this.playerTurn.socket.emit('addnewhandcards', this.playerTurn.hand);
            //Update the game interface
            console.log('send remove ', downCardPosition)
            this.playerTurn.socket.emit('removedowncard', downCardPosition);
            this.playerTurn.socket.emit('updategameinterface', this.playerTurn.hand, this.playerTurn.upCards);
            this.playerTurn.socket.broadcast.emit('removeopponentdowncard', this.playerTurn.playerNumber, downCardPosition);
            this.playerTurn.socket.emit('gamecommentary', 'Your down card wasn\'t legal, so you had to pick up');
            this.playerTurn.socket.broadcast.emit('gamecommentary', 'Opponent played an illegal down card, so had to pick up');
            //Set playerTurn to the previous player
            if (this.direction_of_play.direction == "CLOCKWISE") {
              this.switchPlayerAntiClockwise();
            } else {
              this.switchPlayerClockwise();
            }
            //If the player didn't play a downCard and it wasn't legal, tell them this
          } else {
            this.playerTurn.socket.emit('updateusermessagebox', "Illegal move");
            this.gamePlay();
            return;
          };
          //If the move was legal
        } else {
          //Find the cards the player played. Search depending on where the cards were played from
          for (let j = 0; j < cardsPlayed.length; j++) {
            this.findAndPushCard(setOfCards, cardsPlayed[j]);
          };
          //If there are cards left to pick up, remove as many from the deck as the player played and put them in the player's hand
          for (let i = 0; i < cardsPlayed.length; i ++) {
            this.pickUpCard();
          };
          var consecBurn = this.checkConsecutiveBurn();
          var anotherTurn = consecBurn;
          //If a 10 was played, burn the active deck
          if (cardNumberPlayed == 10) {
            this.activeDeck = [];
            anotherTurn = true;
          };
          //If one Joker was played, switch direction
          if (cardsPlayed.length == 1 && (cardPlayed == "BWJoker" || cardPlayed == "ColorJoker")) {
            this.direction_of_play.switchDirection();
          };
          //Update the game interface
          if (setOfCards == 'downCards') {
            console.log('send remove ', downCardPosition)
            this.playerTurn.socket.emit('removedowncard', downCardPosition);
            this.playerTurn.socket.broadcast.emit('removeopponentdowncard', this.playerTurn.playerNumber, downCardPosition);
          };
          this.playerTurn.socket.emit('updategameinterface', this.playerTurn.hand, this.playerTurn.upCards);
          if (setOfCards == 'upCards') {
            this.playerTurn.socket.broadcast.emit('updateopponentactivedeck', [this.playerTurn.upCards, this.playerTurn.playerNumber]);
          };
          var message = this.commentaryForCardsPlayed(cardsPlayed, cardNumberPlayed, consecBurn);
          this.playerTurn.socket.emit('gamecommentary', message[0]);
          this.playerTurn.socket.broadcast.emit('gamecommentary', message[1]);
          //Check to see if the turn just played finishes the game
          var gameEnd = this.checkGameEnd();
          //If the player shouldn't get another turn and the game hasn't ended, set playerTurn to the next player
          if (!anotherTurn && !gameEnd) {
            if (this.direction_of_play.direction == "CLOCKWISE") {
              this.switchPlayerClockwise();
            } else {
              this.switchPlayerAntiClockwise();
            }
          };
        };
      };
    };
    if (!gameEnd) {
      //Update the active deck card
      if (this.activeDeck.length == 0) {
        io.to('game_room').emit('updateactivedeck', 'empty');
      } else {
        io.to('game_room').emit('updateactivedeck', this.activeDeck[this.activeDeck.length-1].image_name);
      };
      this.playerTurn.socket.emit('updateusermessagebox', "Your turn");
      this.playerTurn.socket.broadcast.emit('updateusermessagebox', this.playerTurn.playerName+"'s turn");
      this.gamePlay();
    };
  }
  //Main function for gameplay, creates the event listener for each turn,
  //removes it once it has been triggered, and emits the playturn signal
  gamePlay() {
    io.to('game_room').emit('log', 'gamePlay');
    //Assign the player to play
    this.playerTurn = this.players[this.playerTurnIndex];
    var self = this;

    //Call the playTurn function to play a turn, based on where the player is playing cards from
    this.playerTurn.socket.on('turnmade', function callPlay(selectedCards) {
      self.playerTurn.socket.off('turnmade', callPlay);
      if (self.playerTurn.hand.length > 0) {
        self.playTurn(selectedCards, 'hand');
      } else if (self.playerTurn.upCards.length > 0) {
        self.playTurn(selectedCards, 'upCards');
      } else {
        self.playTurn(selectedCards, 'downCards');
      }
    });
    if (this.playerTurn.hand.length > 0) {
      this.playerTurn.socket.emit('playturn', 'handCard', 'ownHandCard', self.playerTurn.hand.length);
    } else if (this.playerTurn.upCards.length > 0) {
      this.playerTurn.socket.emit('playturn', 'upCard', 'ownCardPlaceholder', self.playerTurn.upCards.length);
    } else {
      this.playerTurn.socket.emit('playturn', 'downCard', 'ownCardPlaceholder', self.playerTurn.downCards.length);
    }
  }
  initialiseGame() {
    this.reset();
    this.state = "inSetup";
    this.deck = createDeck();
    this.deck = shuffleDeck(this.deck);
    //Assign number of cards based on number of players
    if (this.players.length == 2) {
      this.numberOfCards = 6;
    } else if (this.players.length == 3) {
      this.numberOfCards = 4;
    } else {
      this.numberOfCards = 3;
    };
    //Deal downCards
    for (let i = 0; i < this.numberOfCards; i++) {
      for (let j = 0; j < this.players.length; j++) {
        this.players[j].downCards[i] = this.deck.pop();
      };
    };
    //Deal upCards
    for (let i = 0; i < this.numberOfCards; i++) {
      for (let j = 0; j < this.players.length; j++) {
        this.players[j].upCards[i] = this.deck.pop();
      };
    };
    //Deal handCards
    for (let i = 0; i < this.numberOfCards; i++) {
      for (let j = 0; j < this.players.length; j++) {
        this.players[j].hand[i] = this.deck.pop();
      };
    };
    this.sendInitialisedCardsToPlayers();
  
    io.to('game_room').emit('allowcardswaps', this.players[0].hand.length);

    //Callback function for dealing with calling the swap method properly
    function callBack(self, i) {
      return function(hand, upCards) {
        self.players[i].socket.off('swapdone', callBack)
        self.players[i].swapCards(self, hand, upCards)
      }
    }

    //Create listeners for each client sending their swapped cards, using callback function to avoid closure issue
    for (i = 0; i < this.players.length; i++ ){
      this.players[i].socket.on('swapdone', callBack(this, i))
    };
  }
  //Function to decide which player goes first
  chooseFirstPlayer() {
    io.to('game_room').emit('log', 'chooseFirstPlayer');

    //If this is the first game, randomise starting player with equal chance based on number of players
    if (this.isFirstGame) {
      var random = Math.random();
      for (let i = 1; i < this.players.length+1; i++) {
        //i as multiplier, 1/players.length gives equal divisions for each player to get the first turn
        //See versions <v2.2 for the old way of calculating the first player explicitly
        if (random < i*(1/this.players.length)) {
          this.playerTurnIndex = i-1;
          this.playerTurn = this.players[this.playerTurnIndex];
          this.createOpponentArray(this.playerTurnIndex);
          break;
        }
      };
    //If this is not the first game, assign the first player based on the player who won the last game
    } else {
      this.playerTurn = this.previousGameWinner;
      this.opponentPlayers = this.createOpponentArray(this.previousGameWinner.playerNumber-1);
    };
    this.playerTurn.socket.emit('updateusermessagebox', "Your turn");
    this.playerTurn.socket.broadcast.emit('updateusermessagebox', this.playerTurn.playerName+"'s turn");

    //Call the gamePlay function, the main function for gameplay
    this.state = "inGame";
    this.gamePlay();
  }
  updatePlayerInterfaces() {
    this.sendInitialisedCardsToPlayers();
    for (let i = 0; i < this.players.length; i++) {

      //Update the active deck
      if (this.activeDeck.length != 0) {
        var activeCard = this.activeDeck[this.activeDeck.length-1].image_name;
      } else {
        var activeCard = 'empty';
      };
      this.players[i].socket.emit('updateactivedeck', activeCard);

      //For each of the players downCards that have been played, remove the downCard
      for (let j = 0; j < this.players[i].downCards.length; j++) {
        if (this.players[i].downCards[j] == null) {
          this.players[i].socket.emit('removedowncard', j);
        };
      };

      //For each other player in the game
      for (let j = 0; j < this.players.length; j++) {
        if (this.players[j].playerNumber != this.players[i].playerNumber) {
          this.players[i].socket.emit('updateopponentactivedeck', [this.players[j].upCards, this.players[j].playerNumber]);
          //For each of their downCards that have been played, remove the downCard
          for (let k = 0; k < this.players[j].downCards.length; k++) {
            if (this.players[j].downCards[k] == null) {
              this.players[i].socket.emit('removeopponentdowncard', this.players[j].playerNumber, j);
            };
          };
        };
      };

      //Send each player the playerNames list
      this.players[i].socket.emit('playernames', this.playerNames, this.players[i].playerNumber);
      this.players[i].socket.emit('confirmplayername', this.players[i].playerName);
    };
  }
}

//Callback function to handle starting the game when all players are ready
function startGameCallBack(players, socket) {
  return function(playerName) {
    //Check if player name is already taken
    for (let i = 0; i < players.length; i++) {
      if (players[i].playerName == playerName) {
        socket.emit('playernametaken');
        return;
      };
    };
    socket.emit('confirmplayername', playerName);
    //Find the player that sent the signal, set their readyToPlay flag to true, and set their playerName
    for (let i = 0; i < players.length; i++) {
      if (players[i].socket.id == socket.id) {
        players[i].readyToPlay = true;
        players[i].setPlayerName(playerName);
        break;
      };
    };
    //Determine if all players are ready to play
    var allReady = true;
    for (let i = 0; i < players.length; i++) {
      if (players[i].readyToPlay == false) {
        allReady = false;
        break;
      };
    };
    //If all players are ready, initialise the game
    if (allReady) {
      io.to('game_room').emit('updateusermessagebox', "");
      //Create the playerNames array
      var playerNames = [];
      for (let i = 0; i < players.length; i++) {
        playerNames.push(players[i].playerName);
      };
      for (let i = 0; i < players.length; i++) {
        players[i].socket.emit('playernames', playerNames, players[i].playerNumber);
      };
      game.players = players;
      game.playerNames = playerNames;
      game.initialiseGame();
    };
  };
};

//Function to handle disconnected players reconnecting to the game
function handleReconnect(players, disconnectedPlayers, socket) {
  return function(playerName) {
    //Find the player whose name matches in the disconnected players array
    var disconnectedIndex = null;
    for (let i = 0; i < disconnectedPlayers.length; i++) {
      if (disconnectedPlayers[i].playerName == playerName) {
        disconnectedIndex = i;
        break;
      };
    };

    //If the chosen player name has not disconnected, tell the player they must choose a disconnected player name
    if (disconnectedIndex == null) {
      socket.emit('playernotdisconnected');
      return;
    };
    
    //Move data from the disconnected players array to the players array, with new socket and id data
    players.push(disconnectedPlayers[disconnectedIndex]);
    players[players.length-1].socket = socket;
    players[players.length-1].id = socket.id;
    disconnectedPlayers.splice(disconnectedIndex, 1);
    //Sort the players array by player number
    players.sort(function(firstPlayer, secondPlayer) {
      return firstPlayer.playerNumber - secondPlayer.playerNumber;
    });
    game.players = players;

    //If all players are now reconnected
    if (disconnectedPlayers.length == 0) {
      io.to('game_room').emit('reconnected');
      //Fully update each player's interface
      game.updatePlayerInterfaces();
      //Resume game play
      game.playerTurn.socket.emit('updateusermessagebox', "Your turn");
      game.gamePlay();
    //If there are still disconnected players, return, don't take action until all players have reconnected
    } else {
      return;
    };
  };
};

var players = [];
var playerNumber = 1;
var disconnectedPlayers = [];
var game = new Game();

io.on('connection', function(socket) {
  if (players.length < 5) {
    //If a game has not yet started
    if (game.state == "beforeGame") {
      players.push(new Player(socket, socket.id, playerNumber));
      playerNumber++;
      socket.join('game_room');
      if (players.length == 1) {
        io.to('game_room').emit('updateusermessagebox', 'Waiting for opponent to connect');
      } else {
        io.to('game_room').emit('updateusermessagebox', 'Number of players connected: ' + players.length);
        io.to('game_room').emit('allowplayertostartgame');
      };
      //Listen for each socket sending their startgame signal, and use callback function to handle this
      socket.on('startgame', startGameCallBack(players, socket));
    } else {
      //If a game is in play and there are no disconnected players, or a game is in setup,
      //don't allow the new client to join
      if (disconnectedPlayers.length == 0 || game.state == "inSetup") {
        socket.emit('updateusermessagebox', "A game is already being played");
        socket.disconnect(true);
      //If there is a disconnected player, allow them to join but handle differently
      } else {
        socket.emit('waitingforopponent', players.length);
        socket.emit('reconnectplayer', players.length);
        socket.on('reconnectwithname', handleReconnect(players, disconnectedPlayers, socket));
      };
    };
  } else {
    socket.emit('maxplayers');
    socket.disconnect(true);
  };
  
  //On disconnection, push player onto an array for disconnected players and delete player from players array
  socket.on('disconnect', function(data) {
    for (i = 0; i < players.length; i++) {
      if (players[i].id == socket.id) {
        disconnectedPlayers.push(players[i]);
        players.splice(i, 1);
        io.to('game_room').emit('playerdisconnected');
      };
    };
  });
});