var socket = io();

//Recreate the placeholders for each card when a new game is to be played
socket.on('recreatecards', function() {
  document.getElementById('opponentTableCardsContainer').innerHTML=
  '<h3 class="playerLabel">Opponent</h3>' +
  '<img class="card" id="opponentCardPlaceholder1">' +
  '<img class="card" id="opponentCardPlaceholder2">' +
  '<img class="card" id="opponentCardPlaceholder3">' +
  '<img class="card" id="opponentCardPlaceholder4">' +
  '<img class="card" id="opponentCardPlaceholder5">' +
  '<img class="card" id="opponentCardPlaceholder6">'
  document.getElementById('activeDeckContainer').innerHTML='<img class="upCard" id="activeDeckCard"></img>'
  document.getElementById('ownTableCardsContainer').innerHTML=
  '<h3 class="playerLabel">You</h3>' +
  '<img class="card" id="ownCardPlaceholder1">' +
  '<img class="card" id="ownCardPlaceholder2">' +
  '<img class="card" id="ownCardPlaceholder3">' +
  '<img class="card" id="ownCardPlaceholder4">' +
  '<img class="card" id="ownCardPlaceholder5">' +
  '<img class="card" id="ownCardPlaceholder6">'
  document.getElementById('ownHandContainer').innerHTML=
  '<h3 class="playerLabel">Your hand</h3>' +
  '<img class="card" id="ownHandCard1">' +
  '<img class="card" id="ownHandCard2">' +
  '<img class="card" id="ownHandCard3">' +
  '<img class="card" id="ownHandCard4">' +
  '<img class="card" id="ownHandCard5">' +
  '<img class="card" id="ownHandCard6"></img>'
});

//Display the cards for all the opponents' up cards, the player's up cards, and the player's hand
socket.on('initialisecards', function(ownUpCards, ownHand, opponentUpCards, numberOfPlayers, cards, playerNumber) {
  //If there are more than 2 players, make a new section underneath the game instructions for opponents' cards
  if (numberOfPlayers > 2) {
    document.getElementById('opponentTableCardsContainer').remove();
    container = document.getElementById('insContainer');
    container.innerHTML+='<div id="opponentTableCardsContainer">';
    innerContainer = document.getElementById('opponentTableCardsContainer');
    if (cards == 4) {
      innerContainer.style.width="280px";
    } else {
      innerContainer.style.width="215px";
    };
    innerContainer.innerHTML='<h3 class="playerLabel">Opponents</h3>';
    k = 0;  //Variable for accessing the opponentUpCards array
    for (i = 1; i < numberOfPlayers+1; i++) {
      if (i != playerNumber) {
        for (j = 1; j < cards+1; j++) {
          filename = '/static/cards/' +  opponentUpCards[k][j-1].image_name + '.png';
          innerContainer.innerHTML+='<img class="card" id="player'+i+'CardPlaceholder'+j+'">';
          document.getElementById('player'+i+'CardPlaceholder'+j).src=filename;
        };
        k++;  //Whereas i increments in the for loop, k must only increment if the array was accessed
      };
    };
    document.getElementById('ownCardPlaceholder5').remove();
    document.getElementById('ownCardPlaceholder6').remove();
    if (numberOfPlayers > 3) {
      document.getElementById('ownCardPlaceholder4').remove();
    }
  } else {
    if (playerNumber == 1) {
      opponentPlayerNumber = 2;
    } else {
      opponentPlayerNumber = 1;
    };
    container = document.getElementById('opponentTableCardsContainer');
    container.innerHTML = '<h3 class="playerLabel">Opponent</h3>';
    for (i = 1; i < opponentUpCards[0].length+1; i++) {
      container.innerHTML += '<img class="card" id="player'+opponentPlayerNumber+'CardPlaceholder'+i+'">';
      filename = '/static/cards/' + opponentUpCards[0][i-1].image_name + '.png';
      document.getElementById('player' + opponentPlayerNumber + 'CardPlaceholder' + i).src=filename;
    };
  }
  for (i = 1; i < ownUpCards.length+1; i++) {
    filename = '/static/cards/' + ownUpCards[i-1].image_name + '.png';
    document.getElementById('ownCardPlaceholder' + i).src=filename;
  };
  for (i = 1; i < ownHand.length+1; i++) {
    filename = '/static/cards/' + ownHand[i-1].image_name + '.png';
    document.getElementById('ownHandCard' + i).src=filename;
  };
});

//Function for swapping hand cards with up cards at the start of the game
socket.on('allowcardswaps', function(cards) {

  //Callback functions allow creation of onclick functions within for loops, while avoiding creating closures
  function upCardCallback(i, j, handCard) {
    return function() {
      upCard = document.getElementById('ownCardPlaceholder' + j).src;
      document.getElementById('ownHandCard' + i).src=upCard;
      document.getElementById('ownCardPlaceholder' + j).src=handCard;
      document.getElementById('ownHandCard' + i).style.border='none';
      for (i = 1; i < cards+1; i++) {
        document.getElementById('ownHandCard' + i).style.cursor='pointer';
        document.getElementById('ownHandCard' + i).onclick=handCardCallback(i);
        document.getElementById('ownCardPlaceholder' + i).style.cursor='auto';
        document.getElementById('ownCardPlaceholder' + i).onclick=null;
      };
    };
  };
  
  function handCardCallback(i) {
    return function() {
      handCard = document.getElementById('ownHandCard' + i).src;
      document.getElementById('ownHandCard' + i).style.border='solid red 2px';
      for (j = 1; j < cards+1; j++) {
        document.getElementById('ownHandCard' + j).style.cursor='auto';
        document.getElementById('ownHandCard' + j).onclick=null;
        document.getElementById('ownCardPlaceholder' + j).style.cursor='pointer';
        document.getElementById('ownCardPlaceholder' + j).onclick=upCardCallback(i, j, handCard);
      };
      document.getElementById('ownHandCard' + i).style.cursor='pointer';
      document.getElementById('ownHandCard' + i).onclick=function() {
        document.getElementById('ownHandCard' + i).style.border='none';
        for (i = 1; i < cards+1; i++) {
          document.getElementById('ownHandCard' + i).style.cursor='pointer';
          document.getElementById('ownHandCard' + i).onclick=handCardCallback(i);
          document.getElementById('ownCardPlaceholder' + i).style.cursor='auto';
          document.getElementById('ownCardPlaceholder' + i).onclick=null;
        };
      };
    };
  };

  activeDeckCard = document.getElementById('activeDeckCard')
  activeDeckCard.src='/static/cards/done.png';
  activeDeckCard.style.cursor='pointer';
  activeDeckCard.onclick=function() {
    hand = []
    upCards = []
    for (i = 1; i < cards+1; i++) {
      hand.push(document.getElementById('ownHandCard' + i).src);
      upCards.push(document.getElementById('ownCardPlaceholder' + i).src);
    };
    activeDeckCard.src='/static/waiting.png';
    activeDeckCard.style.cursor='auto';
    activeDeckCard.onclick=null;
    socket.emit('swapdone', hand, upCards);
  };
  for (i = 1; i < cards+1; i++) {
    document.getElementById('ownHandCard' + i).style.cursor='pointer';
    document.getElementById('ownHandCard' + i).onclick=handCardCallback(i);
  };
});

//Function to disable the ability to swap cards, reset the cursor, and click "Done"
socket.on('disablecardswaps', function(cards) {
  for (i = 1; i < cards+1; i++) {
    document.getElementById('ownHandCard' + i).onclick=null;
    document.getElementById('ownHandCard' + i).style.cursor='auto';
    document.getElementById('ownCardPlaceholder' + i).onclick=null;
    document.getElementById('ownCardPlaceholder' + i).style.cursor='auto';
  }
  document.getElementById('activeDeckCard').onclick=null;
  document.getElementById('activeDeckCard').style.cursor='auto';
  document.getElementById('activeDeckCard').src='/static/wood.png';
});

//Function to update the card shown on the top of the active deck
socket.on('updateactivedeck', function(topCard) {
  if (topCard == 'empty') {
    document.getElementById('activeDeckCard').src='/static/wood.png';
  } else {
    filename = '/static/cards/' + topCard + '.png';
    document.getElementById('activeDeckCard').src=filename;
  };
});

//Main function for a player taking their turn
socket.on('playturn', function(cardToPlay, cardType, numberOfCards) {
  console.log('playturn called')
  //Callback functions allow creation of onclick functions within for loops, while avoiding creating closures
  function deselectCardCallback(i, selectedCards, cardToPlay) {
    return function() {
      //Remove the card's border
      clickedCard = document.getElementById(cardType + i)
      clickedCard.style.border='none';
      //Find the card in the array and remove it
      for (j = 0; j < selectedCards.length; j++) {
        if (selectedCards[j] == clickedCard.src) {
          selectedCards.splice(j, 1);
          break;
        };
      };
      //Recreate the onclick function for selecting the card
      clickedCard.onclick=selectCardCallback(i, selectedCards, cardToPlay);
    };
  };
  function selectCardCallback(i, selectedCards, cardToPlay) {
    //Border the card, push it onto an array, and create an onclick function for deselecting it
    return function() {
      clickedCard = document.getElementById(cardType + i)
      clickedCard.style.border='solid red 2px';
      if (cardToPlay == 'downCard') {
        console.log('chose card ', i)
        console.log('submitted ', i-1)
        selectedCards[0] = i-1
      } else {
        selectedCards.push(clickedCard.src);
      }
      clickedCard.onclick=deselectCardCallback(i, selectedCards, cardToPlay);

      //Remove the activeDeckCard's onclick function and create a new one for submitting the selected cards
      document.getElementById('activeDeckCard').onclick=null;
      document.getElementById('activeDeckCard').onclick=function() {
        socket.emit('turnmade', selectedCards);
        //Remove onclick functions and borders for all cards
        for (i = 1; i < numberOfCards+1; i++) {
          if (document.getElementById(cardType + i)) {
            document.getElementById(cardType + i).onclick=null;
            document.getElementById(cardType + i).style.cursor='auto';
            document.getElementById(cardType + i).style.border='none';
          };
        };
        document.getElementById('activeDeckCard').onclick=null;
        document.getElementById('activeDeckCard').style.cursor='auto';
        return selectedCards;
      };
    };
  };

  //Set the action for the activeDeckCard
  document.getElementById('activeDeckCard').style.cursor='pointer';
  document.getElementById('activeDeckCard').onclick=function(){
    socket.emit('turnmade', 'pickup');
    //Remove onclick functions for all cards if the activeDeckCard has been clicked
    for (i = 1; i < numberOfCards+1; i++) {
      if (document.getElementById(cardType + i)) {
        document.getElementById(cardType + i).onclick=null;
        document.getElementById(cardType + i).style.cursor='auto';
      };
    };
    document.getElementById('activeDeckCard').onclick=null;
    document.getElementById('activeDeckCard').style.cursor='auto';
  }

  var selectedCards = [];
  //Create onclick functions for each card
  for (i = 1; i < numberOfCards+1; i++) {
    if (document.getElementById(cardType + i)) {
      document.getElementById(cardType + i).style.cursor='pointer';
      document.getElementById(cardType + i).onclick=selectCardCallback(i, selectedCards, cardToPlay);
    };
  };
});

socket.on('updategameinterface', function(hand, upCards) {
  //For each handCard, set the placeholder
  for (i = 1; i < hand.length+1; i++) {
    document.getElementById('ownHandCard' + i).src='/static/cards/' + hand[i-1].image_name + '.png';
  };
  //Count the handCard placeholders
  handCardHolders = document.getElementById('ownHandContainer').children.length - 1;
  //If there are more placeholders than handCards, remove the extra placeholders
  if (handCardHolders > hand.length) {
    for (i = hand.length+1; i < handCardHolders+1; i++) {
      element = document.getElementById('ownHandCard' + i);
      element.parentNode.removeChild(element);
    };
  };
  //For each upCard, set the placeholder
  for (i = 1; i < upCards.length+1; i++) {
    document.getElementById('ownCardPlaceholder' + i).src='/static/cards/' + upCards[i-1].image_name + '.png';
  };
  //Count the upCard placeholders
  tableCardHolders = document.getElementById('ownTableCardsContainer').children.length - 1;
  //If there are more placeholders than upCards, set the placeholders to downCard card_back's
  if (tableCardHolders > upCards.length) {
    for (i = upCards.length+1; i < tableCardHolders+1; i++) {
      element = document.getElementById('ownCardPlaceholder' + i);
      if (element != null) {
        element.src='/static/cards/card_back.png';
      };
    };
  };
});

socket.on('updateopponentactivedeck', function(data) {
  playerUpCards = data[0];
  playerNumber = data[1];
  for (i = 1; i < playerUpCards.length+1; i++) {
    document.getElementById('player' + playerNumber + 'CardPlaceholder' + i).src='/static/cards/' + playerUpCards[i-1].image_name + '.png';
  };
  elements = document.getElementById('opponentTableCardsContainer').children;
  playerCardHolders = 0;
  for (i = 1; i < elements.length; i++) {
    if (elements[i].id.slice(0,7) == "player" + playerNumber) {
      playerCardHolders++
    };
  };
  if (playerCardHolders > playerUpCards.length) {
    for (i = playerUpCards.length+1; i < playerCardHolders+1; i++) {
      element = document.getElementById('player' + playerNumber + 'CardPlaceholder' + i);
      if (element != null) {
        element.src='/static/cards/card_back.png';
      };
    };
  };
})

socket.on('updateusermessagebox', function(message) {
  document.getElementById('userMessageBox').innerHTML=message;
});

socket.on('playerdisconnected', function() {
  document.getElementById('userMessageBox').innerHTML="Player disconnected";
  document.getElementById('gameContainer').hidden='true';
});

socket.on('reconnected', function() {
  document.getElementById('userMessageBox').innerHTML="Player reconnected";
  document.getElementById('gameContainer').removeAttribute('hidden');
});

socket.on('gamecommentary', function(message) {
  document.getElementById('gameCommentary').innerHTML=message;
});

socket.on('addnewhandcards', function(hand) {
  handCardHolders = document.getElementById('ownHandContainer').children.length - 1;
  for (i = handCardHolders+1; i < hand.length+1; i++) {
    newElement = '<img class="card" id="ownHandCard' + i + '">';
    document.getElementById('ownHandContainer').innerHTML+=newElement;
  };
});

socket.on('removedowncard', function(i) {
  document.getElementById('ownCardPlaceholder' + (i+1)).remove();
});

socket.on('removeopponentdowncard', function(playerNumber, cardPlaceholderNumber) {
  element = document.getElementById('player' + playerNumber + 'CardPlaceholder' + (cardPlaceholderNumber+1));
  element.src = '/static/blank.png';
});

socket.on('allowplayertostartgame', function() {
  document.getElementById('gameContainer').removeAttribute('hidden');
  deckCard = document.getElementById('activeDeckCard');
  deckCard.src='/static/start_game.png';
  deckCard.style.cursor='pointer';
  deckCard.onclick=function(){
    playerName = prompt("Enter a player name:");
    socket.emit('startgame', playerName);
    deckCard.src='/static/waiting.png';
    deckCard.style.cursor='auto';
    deckCard.onclick=null;
  }
});

socket.on('reconnectplayer', function() {
  document.getElementById('gameContainer').removeAttribute('hidden');
  deckCard = document.getElementById('activeDeckCard');
  deckCard.src='/static/start_game.png';
  deckCard.style.cursor='pointer';
  deckCard.onclick=function(){
    playerName = prompt("Enter a player name:");
    socket.emit('reconnectwithname', playerName);
    deckCard.src='/static/waiting.png';
    deckCard.style.cursor='auto';
    deckCard.onclick=null;
  }
});

socket.on('playernametaken', function() {
  playerName = null;
  while (playerName == null) {
    playerName = prompt("Player name taken. Choose another player name: ");
  };
  socket.emit('startgame', playerName);
});

socket.on('playernotdisconnected', function() {
  playerName = prompt("A game is in progress and the player name you chose does not match any disconnected players. Please enter the player name of a disconnected player to join the game: ");
  socket.emit('reconnectwithname', playerName);
});

socket.on('confirmplayername', function(playerName) {
  document.getElementById('playerName').innerHTML="You:<br />"+playerName;
});

socket.on('playernames', function(playerNames, playerNumber) {
  playerNamesString = '';
  i = 1;
  while (playerNames[i-1]) {
    if (i != playerNumber) {
      playerNamesString += playerNames[i-1];
      playerNamesString += ", ";
    };
    i++;
  };
  playerNamesString = playerNamesString.slice(0, -2);
  document.getElementById('opponentPlayerNames').innerHTML="Opponent players:<br />"+playerNamesString;
});

socket.on('gameend', function(result) {
  if (result == 'win') {
    document.getElementById('userMessageBox').innerHTML='Congratulations! You won the game!';
  } else if (result == 'lose') {
    document.getElementById('userMessageBox').innerHTML='You lost the game! Better luck next time';
  };
  /*
  document.getElementById('activeDeckCard').src='/static/new_game.png';
  document.getElementById('activeDeckCard').style.cursor='pointer';
  document.getElementById('activeDeckCard').onclick=function() {
    socket.emit('newgame');
  };
  */
});

socket.on('log', function(data) {
  console.log(data);
});
