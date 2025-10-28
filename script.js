const BMChat = {
    isOpen: false,
    sessionId: null,
    currentState: null,
    lastUserMessage: '',
    webhookUrl: 'https://auto.golubef.store/webhook/chat-bm',
    fileUploadUrl: 'https://auto.golubef.store/webhook/tilda-file-upload',
    
    init: function() {
        console.log('=== BMChat init started ===');
        this.loadChatHistory();
        
        if (!this.sessionId) {
            this.sessionId = this.generateSessionId();
            console.log('Generated NEW sessionId:', this.sessionId);
            this.saveChatHistory();
        } else {
            console.log('Restored sessionId from history:', this.sessionId);
        }
        
        this.setupEventListeners();
        this.setupIOSFixes();
        this.setupFileUpload();
        
        const staticReplies = document.getElementById('bmQuickReplies');
        if (staticReplies) {
            staticReplies.remove();
        }
        
        const self = this;
        setTimeout(function() {
            if (!self.sessionId) {
                console.error('CRITICAL: sessionId still null!');
                self.sessionId = self.generateSessionId();
            }
            self.saveChatHistory();
            console.log('Force saved sessionId:', self.sessionId);
        }, 1000);
        
        console.log('=== BMChat init finished. SessionId:', this.sessionId, '===');
    },
    
    generateSessionId: function() {
        return 'web_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },
    
    setupFileUpload: function() {
        const fileInput = document.querySelector('input[type="file"]');
        if (fileInput) {
            const self = this;
            fileInput.addEventListener('change', function(e) {
                const file = e.target.files[0];
                if (file) {
                    self.handleFileUpload(file);
                }
            });
        }
    },
    
    handleFileUpload: function(file) {
        console.log('File upload started:', file.name);
        this.addMessage('📎 Загружаю файл: ' + file.name + '...', 'user');
        this.showTyping();
        
        const self = this;
        const fileUrl = 'URL_ОТ_ТИЛЬДЫ';
        
        fetch(this.fileUploadUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userfile: fileUrl,
                chat_id: this.sessionId,
                message: 'Пользователь загрузил файл: ' + file.name
            })
        })
        .then(function(response) {
            console.log('File upload response status:', response.status);
            return response.text();
        })
        .then(function(responseText) {
            console.log('File upload raw response:', responseText);
            const data = JSON.parse(responseText);
            self.hideTyping();
            
            if (data.response) {
                self.addMessage(data.response, 'bot', data.quick_replies);
                if (data.state) self.currentState = data.state;
            } else {
                throw new Error('Нет ответа от сервера');
            }
        })
        .catch(function(error) {
            console.error('File upload error:', error);
            self.hideTyping();
            self.addMessage('❌ Ошибка загрузки файла: ' + error.message, 'bot');
        });
    },
    
    setupIOSFixes: function() {
        const viewport = document.querySelector('meta[name=viewport]');
        if (viewport) {
            viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, user-scalable=no');
        }
        
        const textarea = document.getElementById('bmMessageInput');
        if (textarea) {
            textarea.addEventListener('focus', function() {
                document.body.style.position = 'fixed';
                document.body.style.width = '100%';
            });
            
            textarea.addEventListener('blur', function() {
                document.body.style.position = '';
                document.body.style.width = '';
            });
        }
    },
    
    setupEventListeners: function() {
        const self = this;
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && self.isOpen) {
                self.toggle();
            }
        });
        
        const observer = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                if (mutation.target.classList.contains('show')) {
                    setTimeout(function() {
                        const input = document.getElementById('bmMessageInput');
                        if (input && window.innerWidth > 768) {
                            input.focus();
                        }
                    }, 300);
                }
            });
        });
        
        const widget = document.getElementById('bmChatWidget');
        if (widget) {
            observer.observe(widget, {
                attributes: true,
                attributeFilter: ['class']
            });
        }
    },
    
    toggle: function() {
        const widget = document.getElementById('bmChatWidget');
        const self = this;
        
        if (this.isOpen) {
            widget.classList.remove('show');
            setTimeout(function() {
                widget.style.display = 'none';
            }, 400);
            this.isOpen = false;
        } else {
            widget.style.display = 'flex';
            setTimeout(function() {
                widget.classList.add('show');
            }, 10);
            this.isOpen = true;
            
            const badge = document.querySelector('.bm-chat-badge');
            if (badge) badge.style.display = 'none';
            
            setTimeout(function() {
                self.scrollToBottom();
            }, 100);
        }
    },
    
    sendMessage: function() {
        const input = document.getElementById('bmMessageInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        if (!this.sessionId) {
            console.error('FATAL: sessionId is NULL!');
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
        
        const self = this;
        const requestBody = {
            message: message,
            sessionId: this.sessionId,
            state: this.currentState,
            firstname: 'Посетитель',
            username: 'web_user',
            timestamp: new Date().toISOString()
        };
        
        console.log('Request body:', JSON.stringify(requestBody, null, 2));
        
        fetch(this.webhookUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        })
        .then(function(response) {
            console.log('Response status:', response.status);
            
            if (!response.ok) {
                throw new Error('HTTP ' + response.status + ': ' + response.statusText);
            }
            
            const contentType = response.headers.get('content-type');
            console.log('Content-Type:', contentType);
            
            if (!contentType || contentType.indexOf('application/json') === -1) {
                throw new Error('Сервер вернул неправильный Content-Type: ' + (contentType || 'отсутствует'));
            }
            
            return response.text();
        })
        .then(function(responseText) {
            console.log('Raw response:', responseText);
            
            if (!responseText || responseText.trim() === '') {
                throw new Error('Пустой ответ от сервера');
            }
            
            return JSON.parse(responseText);
        })
        .then(function(data) {
            console.log('Parsed response:', data);
            self.hideTyping();
            
            if (data.response) {
                self.addMessage(data.response, 'bot', data.quick_replies);
                if (data.state) {
                    self.currentState = data.state;
                } else {
                    self.currentState = null;
                }
            } else {
                throw new Error('В ответе нет поля response');
            }
        })
        .catch(function(error) {
            console.error('Send message error:', error);
            self.hideTyping();
            self.addMessage('❌ ОШИБКА: ' + error.message + '\n\nПопробуйте обновить страницу или написать "Оператор"', 'bot', [
                {title: '🔄 Попробовать снова', value: 'last_message'},
                {title: '👤 Оператор', value: '/operator'}
            ]);
        })
        .finally(function() {
            sendBtn.disabled = false;
            self.saveChatHistory();
        });
    },

    sendQuickReply: function(title, value) {
        this.addMessage(title, 'user');
        const input = document.getElementById('bmMessageInput');
        input.value = value === 'last_message' ? this.lastUserMessage : value;
        this.sendMessage();
    },
    
    addMessage: function(content, sender, quickReplies) {
        const messagesContainer = document.getElementById('bmChatMessages');
        
        const existingReplies = messagesContainer.querySelectorAll('.bm-quick-replies, .bm-upload-btn');
        existingReplies.forEach(function(el) { el.remove(); });

        const messageDiv = document.createElement('div');
        messageDiv.className = 'bm-message ' + sender;
        
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageDiv.innerHTML = '<div class="bm-message-content">' +
            content.replace(/\n/g, '<br>') +
            '<div class="bm-message-time">' + timeStr + '</div>' +
            '</div>';
        
        messagesContainer.appendChild(messageDiv);

        if (quickReplies && quickReplies.length > 0) {
            this.showQuickReplies(quickReplies);
        }

        this.scrollToBottom();
        
        if (sender === 'bot' && !this.isOpen) {
            const badge = document.querySelector('.bm-chat-badge');
            if (badge) badge.style.display = 'flex';
        }
    },
    
    showTyping: function() {
        const indicator = document.getElementById('bmTypingIndicator');
        if (indicator) {
            indicator.style.display = 'block';
            this.scrollToBottom();
        }
    },
    
    hideTyping: function() {
        const indicator = document.getElementById('bmTypingIndicator');
        if (indicator) indicator.style.display = 'none';
    },
    
    scrollToBottom: function() {
        const messages = document.getElementById('bmChatMessages');
        if (messages) {
            messages.scrollTop = messages.scrollHeight;
        }
    },

    showQuickReplies: function(replies) {
        const messagesContainer = document.getElementById('bmChatMessages');
        const repliesContainer = document.createElement('div');
        repliesContainer.className = 'bm-quick-replies';
        
        const self = this;
        replies.forEach(function(reply) {
            const button = document.createElement('button');
            button.textContent = reply.title;
            const value = reply.value === 'last_message' 
                ? (self.lastUserMessage || '') 
                : reply.value;
            button.onclick = function() { self.sendQuickReply(reply.title, value); };
            repliesContainer.appendChild(button);
        });
        messagesContainer.appendChild(repliesContainer);
        this.scrollToBottom();
    },
    
    handleKeyPress: function(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendMessage();
        }
    },
    
    autoResize: function(textarea) {
        textarea.style.height = '20px';
        textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    },
    
    clearChat: function() {
        if (confirm('Очистить историю чата?')) {
            const messagesContainer = document.getElementById('bmChatMessages');
            messagesContainer.innerHTML = '<div class="bm-message bot">' +
                '<div class="bm-message-content">Чат очищен. Готов к новым задачам!</div>' +
                '</div>';
            
            this.sessionId = this.generateSessionId();
            this.currentState = null;
            localStorage.removeItem('bm_chat_history');
            this.saveChatHistory();
            console.log('Chat cleared. New sessionId:', this.sessionId);
        }
    },
    
    saveChatHistory: function() {
        const messages = document.getElementById('bmChatMessages');
        if (!messages) {
            console.warn('Cannot save: bmChatMessages not found');
            return;
        }
        
        const chatData = {
            sessionId: this.sessionId,
            currentState: this.currentState,
            messages: messages.innerHTML,
            timestamp: Date.now()
        };
        
        try {
            localStorage.setItem('bm_chat_history', JSON.stringify(chatData));
            console.log('Saved. SessionId:', this.sessionId);
        } catch (error) {
            console.error('Error saving:', error);
        }
    },
    
    loadChatHistory: function() {
        const savedData = localStorage.getItem('bm_chat_history');
        
        if (savedData) {
            try {
                const chatData = JSON.parse(savedData);
                
                if (Date.now() - chatData.timestamp > 24 * 60 * 60 * 1000) {
                    console.log('History expired, clearing...');
                    localStorage.removeItem('bm_chat_history');
                    return;
                }
                
                this.sessionId = chatData.sessionId;
                this.currentState = chatData.currentState || null;
                
                const messagesContainer = document.getElementById('bmChatMessages');
                if (messagesContainer && chatData.messages) {
                    messagesContainer.innerHTML = chatData.messages;
                }
                
                console.log('History restored. SessionId:', this.sessionId);
                
            } catch (error) {
                console.error('Error loading history:', error);
                localStorage.removeItem('bm_chat_history');
            }
        } else {
            console.log('No saved history');
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    BMChat.init();
});

window.BMChat = BMChat;
