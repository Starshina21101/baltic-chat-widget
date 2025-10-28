async sendMessage() {
    const input = document.getElementById('bmMessageInput');
    const message = input.value.trim();
    
    if (!message) return;
    
    // КРИТИЧНО: Проверяем sessionId ПЕРЕД отправкой
    if (!this.sessionId) {
        console.error('FATAL: sessionId is NULL! Generating emergency sessionId...');
        this.sessionId = this.generateSessionId();
        this.saveChatHistory();
        console.log('Emergency sessionId created:', this.sessionId);
    }
    
    this.lastUserMessage = message;
    this.addMessage(message, 'user');
    input.value = '';
    this.autoResize(input);
    this.showTyping();
    
    const sendBtn = document.getElementById('bmSendBtn');
    sendBtn.disabled = true;
    
    console.log('=== Sending message ===');
    console.log('Message:', message);
    console.log('SessionId:', this.sessionId);
    console.log('State:', this.currentState);
    
    try {
        const requestBody = {
            message: message,
            sessionId: this.sessionId,
            state: this.currentState,
            firstname: 'Посетитель',
            username: 'web_user',
            timestamp: new Date().toISOString()
        };
        
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        
        const response = await fetch(this.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', [...response.headers.entries()]);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // КРИТИЧНО: Проверяем, есть ли вообще тело ответа
        const contentType = response.headers.get('content-type');
        console.log('Content-Type:', contentType);
        
        if (!contentType || !contentType.includes('application/json')) {
            throw new Error(`Сервер вернул неправильный Content-Type: ${contentType}`);
        }
        
        const responseText = await response.text();
        console.log('Raw response:', responseText);
        
        if (!responseText || responseText.trim() === '') {
            throw new Error('Пустой ответ от сервера');
        }
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            throw new Error('Ошибка парсинга JSON: ' + parseError.message);
        }
        
        console.log('Parsed response:', data);
        this.hideTyping();
        
        if (data.response) {
            this.addMessage(data.response, 'bot', data.quick_replies);
            if (data.state) {
                this.currentState = data.state;
            } else {
                this.currentState = null;
            }
        } else {
            throw new Error('В ответе нет поля "response"');
        }
        
    } catch (error) {
        console.error('Send message error:', error);
        this.hideTyping();
        this.addMessage('❌ ОШИБКА: ' + error.message + '\n\nПопробуйте обновить страницу или напишите "Оператор"', 'bot', [
            {title: 'Обновить страницу', value: '/reload'},
            {title: 'Связаться с оператором', value: '/operator'}
        ]);
    } finally {
        sendBtn.disabled = false;
    }
    
    this.saveChatHistory();
}
