// wizardFeatures.js

const WizardFeatures = (function() {
  let appendMessage;
  let mongoDb;
  let getCurrentUserId;

  let currentWizardState = null;

  // Add these functions to manage the wizard state
  function setWizardState(state) {
    currentWizardState = state;
  }

  function getWizardState() {
    return currentWizardState;
  }

  function clearWizardState() {
    currentWizardState = null;
  }


  function init(appendMessageFunction, getCurrentUserIdFunction) {
    appendMessage = appendMessageFunction;
    getCurrentUserId = getCurrentUserIdFunction;
  }

  async function startFeedbackWizard(userId) {
    setWizardState('feedback');

    const questions = [
      "How would you rate your experience?",
      "What did you like most?",
      "What could be improved?",
      "Any additional comments?"
    ];
    
    for (const question of questions) {
      await askQuestion(userId, question);
      const answer = await waitForResponse(userId);
      await saveResponse(userId, 'feedback', question, answer);
    }
    
    appendMessage('assistant', "Thank you for your feedback!", { source: 'LLM' });
    clearWizardState();

  }

  async function startInstructionsWizard(userId) {
    // Implement instructions wizard logic here
  }

  async function askQuestion(userId, question) {
    appendMessage('assistant', question, { source: 'LLM' });
  }

  function waitForResponse(userId) {
    return new Promise((resolve) => {
        const messageHandler = (event) => {
            document.removeEventListener('wizardResponse', messageHandler);
            resolve(event.detail.content);
        };
        document.addEventListener('wizardResponse', messageHandler);
    });
}

  async function saveResponse(userId, wizardType, question, answer) {
    await mongoDb.insertOne('responses', {
      userId,
      wizardType,
      question,
      answer,
      timestamp: new Date()
    });
  }

  async function updateUserWizardState(userId, state) {
    await mongoDb.updateOne('users', 
      { _id: userId },
      { $set: { wizardState: state } }
    );
  }

  async function cancelWizard(userId) {
    clearWizardState();
    await updateUserWizardState(userId, null);
    appendMessage('assistant', "Wizard cancelled. How can I help you?", { source: 'LLM' });
}

  function handleMessage(message) {
    const userId = getCurrentUserId();
    if (!userId) {
        console.error('Failed to get current user ID');
        return;
    }

    const currentState = getWizardState();
    if (currentState === 'feedback') {
      // We're in the middle of a feedback wizard session
      // Handle the response as part of the wizard flow
      const event = new CustomEvent('wizardResponse', { 
          detail: { content: message } 
      });
      document.dispatchEvent(event);
    } else {
      // Not in a wizard session, handle as normal
      if (message.startsWith('/feedback')) {
          startFeedbackWizard(userId);
      } else if (message.startsWith('/instructions')) {
          startInstructionsWizard(userId);
      } else if (message.toLowerCase() === '/cancel') {
          cancelWizard(userId);
      } else {
          // Dispatch a custom event for the message
          const event = new CustomEvent('newMessage', { 
              detail: { sender: 'user', content: message } 
          });
          document.dispatchEvent(event);
      }
    }
  }

  return {
    init: init,
    handleMessage: handleMessage
  };
})();

export default WizardFeatures;

