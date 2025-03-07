// Estado da aplicação
let visitors = [];
let selectedDate = new Date();
let viewDate = new Date();
let offlineQueue = []; // Fila para armazenar operações offline

// Inicialização do Supabase
const supabaseUrl = 'https://qdttsbnsijllhkgrpdmc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkdHRzYm5zaWpsbGhrZ3JwZG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExOTQzNDgsImV4cCI6MjA1Njc3MDM0OH0.CuZdeCC2wK73CrTt2cMIKxj20hAtgz_8qAhFt1EKkCw';
const supabase = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;
let supabaseEnabled = !!window.supabase;

// Elementos do DOM
const DOM = {
    selectedDateText: document.getElementById('selectedDateText'),
    selectedDateInput: document.getElementById('selectedDateInput'),
    datePickerDropdown: document.getElementById('datePickerDropdown'),
    dateSelectorBtn: document.getElementById('dateSelectorBtn'),
    viewDateText: document.getElementById('viewDateText'),
    viewDateInput: document.getElementById('viewDateInput'),
    viewDatePickerDropdown: document.getElementById('viewDatePickerDropdown'),
    viewDateSelectorBtn: document.getElementById('viewDateSelectorBtn'),
    nameInput: document.getElementById('nameInput'),
    phoneInput: document.getElementById('phoneInput'),
    firstTimeCheckbox: document.getElementById('firstTimeCheckbox'),
    addVisitorBtn: document.getElementById('addVisitorBtn'),
    downloadBtn: document.getElementById('downloadBtn'),
    visitorsList: document.getElementById('visitorsList'),
    totalVisitorsCount: document.getElementById('totalVisitorsCount'),
    firstTimeVisitorsCount: document.getElementById('firstTimeVisitorsCount')
};

// Formatação de data no padrão brasileiro (dd/mm/yyyy)
function formatDate(date) {
    return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}

// Ajustar data para evitar problemas de fuso horário
function adjustDate(date) {
    const userTimezoneOffset = date.getTimezoneOffset() * 60000;
    const adjusted = new Date(date.getTime() + userTimezoneOffset);
    adjusted.setHours(0, 0, 0, 0);
    return adjusted;
}

// Função para criar data a partir de string YYYY-MM-DD
function createDateFromString(dateString) {
    const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
    return new Date(year, month - 1, day);
}

// Gerenciamento de conexão de rede
const ConnectionManager = {
    isOnline: navigator.onLine,
    
    init() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('Conexão online detectada');
            this.processPendingOperations();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('Aplicação está offline');
        });
    },
    
    async processPendingOperations() {
        if (!supabaseEnabled || !this.isOnline || offlineQueue.length === 0) return;
        
        console.log(`Processando ${offlineQueue.length} operações pendentes`);
        
        while (offlineQueue.length > 0) {
            const operation = offlineQueue.shift();
            
            try {
                switch (operation.type) {
                    case 'add':
                        await DataManager.addToSupabase(operation.data);
                        break;
                    case 'remove':
                        await DataManager.removeFromSupabase(operation.id);
                        break;
                }
            } catch (error) {
                console.error('Erro ao processar operação pendente:', error);
                // Recoloca a operação na fila
                offlineQueue.push(operation);
                break;
            }
        }
        
        // Salva estado da fila no localStorage
        localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
    }
};

// Gerenciamento de dados
const DataManager = {
    async load() {
        // Carrega visitantes do localStorage
        visitors = JSON.parse(localStorage.getItem('churchVisitors') || '[]');
        
        // Carrega a fila de operações offline
        offlineQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
        
        renderVisitorsList();
        
        if (supabaseEnabled) {
            if (ConnectionManager.isOnline) {
                await this.syncFullFromSupabase(); // Sincronização completa inicialmente 
                ConnectionManager.processPendingOperations(); // Processa operações pendentes
                this.initializeRealtime(); // Inicia escuta em tempo real
            }
        }
    },
    
    async save(syncToSupabase = true) {
        // Sempre salva no localStorage
        localStorage.setItem('churchVisitors', JSON.stringify(visitors));
        
        // Sincroniza com Supabase se habilitado, online e solicitado
        if (supabaseEnabled && syncToSupabase && ConnectionManager.isOnline) {
            await this.syncToSupabase();
        }
    },
    
    async syncFullFromSupabase() {
        if (!supabaseEnabled || !ConnectionManager.isOnline) return;
        
        console.log('Realizando sincronização completa com Supabase');
        
        try {
            const { data, error } = await supabase.from('visitors').select('*');
            
            if (error) throw error;
            
            if (data && data.length > 0) {
                const remoteVisitors = data.map(visitor => ({
                    id: visitor.id,
                    name: visitor.name,
                    phone: visitor.phone,
                    isFirstTime: visitor.isFirstTime,
                    date: visitor.date
                }));
                
                console.log(`Recebidos ${remoteVisitors.length} registros do Supabase`);
                
                // Mesclagem eficiente usando Map
                const visitorMap = new Map();
                
                // Adiciona visitantes locais ao Map
                visitors.forEach(v => visitorMap.set(v.id.toString(), v));
                
                // Substitui ou adiciona visitantes remotos
                remoteVisitors.forEach(v => visitorMap.set(v.id.toString(), v));
                
                visitors = Array.from(visitorMap.values());
                this.save(false); // Salva apenas local, sem loop de sincronização
                renderVisitorsList();
            }
        } catch (error) {
            console.error("Erro ao sincronizar com Supabase:", error);
        }
    },
    
    async syncFromSupabase() {
        // Versão mais leve de sincronização para atualizações em tempo real
        if (!supabaseEnabled || !ConnectionManager.isOnline) return;
        
        try {
            // Busca apenas registros mais recentes (últimos 10 minutos)
            const tenMinutesAgo = new Date(Date.now() - 600000); // 10 minutos
            const isoDate = tenMinutesAgo.toISOString();
            
            const { data, error } = await supabase
                .from('visitors')
                .select('*')
                .gt('created_at', isoDate);
            
            if (error) throw error;
            
            if (data && data.length > 0) {
                console.log(`Recebidas ${data.length} atualizações recentes`);
                
                const remoteVisitors = data.map(visitor => ({
                    id: visitor.id,
                    name: visitor.name,
                    phone: visitor.phone,
                    isFirstTime: visitor.isFirstTime,
                    date: visitor.date
                }));
                
                // Atualiza ou adiciona novos registros
                let updated = false;
                remoteVisitors.forEach(remoteVisitor => {
                    const existingIndex = visitors.findIndex(v => v.id.toString() === remoteVisitor.id.toString());
                    if (existingIndex >= 0) {
                        visitors[existingIndex] = remoteVisitor;
                    } else {
                        visitors.push(remoteVisitor);
                    }
                    updated = true;
                });
                
                if (updated) {
                    this.save(false); // Salva apenas local, sem loop
                    renderVisitorsList();
                }
            }
        } catch (error) {
            console.error("Erro ao sincronizar atualizações do Supabase:", error);
        }
    },
    
    async addToSupabase(visitor) {
        if (!supabaseEnabled || !ConnectionManager.isOnline) return false;
        
        try {
            const { data, error } = await supabase
                .from('visitors')
                .insert([visitor])
                .select();
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Erro ao adicionar visitante ao Supabase:", error);
            return false;
        }
    },
    
    async removeFromSupabase(id) {
        if (!supabaseEnabled || !ConnectionManager.isOnline) return false;
        
        try {
            const { error } = await supabase
                .from('visitors')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return true;
        } catch (error) {
            console.error("Erro ao remover visitante do Supabase:", error);
            return false;
        }
    },
    
    async syncToSupabase() {
        if (!supabaseEnabled || !ConnectionManager.isOnline) return;
        
        try {
            // Envia apenas o visitante mais recente
            if (visitors.length > 0) {
                const latestVisitor = visitors[visitors.length - 1];
                
                const { data: existingData } = await supabase
                    .from('visitors')
                    .select('id')
                    .eq('id', latestVisitor.id);
                    
                if (!existingData || existingData.length === 0) {
                    console.log(`Enviando visitante ${latestVisitor.name} para o Supabase`);
                    await this.addToSupabase(latestVisitor);
                }
            }
        } catch (error) {
            console.error("Erro ao sincronizar com Supabase:", error);
        }
    },
    
    initializeRealtime() {
        if (!supabaseEnabled) return;
        
        console.log('Inicializando escuta em tempo real do Supabase');
        
        supabase
            .channel('visitors-channel')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'visitors' }, 
                payload => {
                    console.log('Notificação de alteração recebida:', payload.eventType);
                    this.syncFromSupabase(); // Versão leve da sincronização
                }
            )
            .subscribe();
    },
    
    async addVisitor(visitorData) {
        // Adiciona visitante à lista local
        visitors.push(visitorData);
        
        // Salva no localStorage
        localStorage.setItem('churchVisitors', JSON.stringify(visitors));
        
        // Verifica se deve sincronizar com Supabase
        if (supabaseEnabled) {
            if (ConnectionManager.isOnline) {
                // Tenta enviar diretamente se online
                const success = await this.addToSupabase(visitorData);
                if (!success) {
                    // Se falhar, adiciona à fila offline
                    offlineQueue.push({ type: 'add', data: visitorData });
                    localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
                }
            } else {
                // Adiciona à fila offline se estiver offline
                offlineQueue.push({ type: 'add', data: visitorData });
                localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
            }
        }
        
        // Atualiza a interface
        if (formatDate(selectedDate) === formatDate(viewDate)) {
            renderVisitorsList();
        }
        
        return true;
    },
    
    async removeVisitor(id) {
        // Remove localmente
        visitors = visitors.filter(visitor => visitor.id !== id);
        localStorage.setItem('churchVisitors', JSON.stringify(visitors));
        
        // Verifica se deve sincronizar com Supabase
        if (supabaseEnabled) {
            if (ConnectionManager.isOnline) {
                // Tenta remover diretamente se online
                const success = await this.removeFromSupabase(id);
                if (!success) {
                    // Se falhar, adiciona à fila offline
                    offlineQueue.push({ type: 'remove', id });
                    localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
                }
            } else {
                // Adiciona à fila offline se estiver offline
                offlineQueue.push({ type: 'remove', id });
                localStorage.setItem('offlineQueue', JSON.stringify(offlineQueue));
            }
        }
        
        // Atualiza a interface
        renderVisitorsList();
    }
};

// Gerenciamento da interface
const UIManager = {
    initializeDates() {
        selectedDate = adjustDate(new Date());
        viewDate = adjustDate(new Date());
        
        DOM.selectedDateText.textContent = `Data do Registro: ${formatDate(selectedDate)}`;
        DOM.viewDateText.textContent = `Visualizar Registros: ${formatDate(viewDate)}`;
        
        DOM.selectedDateInput.value = selectedDate.toISOString().split('T')[0];
        DOM.viewDateInput.value = viewDate.toISOString().split('T')[0];
    },
    
    setupEventListeners() {
        DOM.dateSelectorBtn.addEventListener('click', () => {
            DOM.datePickerDropdown.style.display = DOM.datePickerDropdown.style.display === 'none' ? 'block' : 'none';
            DOM.viewDatePickerDropdown.style.display = 'none';
        });
        
        DOM.selectedDateInput.addEventListener('change', (e) => {
            selectedDate = createDateFromString(e.target.value);
            DOM.selectedDateText.textContent = `Data do Registro: ${formatDate(selectedDate)}`;
            DOM.datePickerDropdown.style.display = 'none';
        });
        
        DOM.viewDateSelectorBtn.addEventListener('click', () => {
            DOM.viewDatePickerDropdown.style.display = DOM.viewDatePickerDropdown.style.display === 'none' ? 'block' : 'none';
            DOM.datePickerDropdown.style.display = 'none';
        });
        
        DOM.viewDateInput.addEventListener('change', (e) => {
            viewDate = createDateFromString(e.target.value);
            DOM.viewDateText.textContent = `Visualizar Registros: ${formatDate(viewDate)}`;
            DOM.viewDatePickerDropdown.style.display = 'none';
            renderVisitorsList();
        });
        
        DOM.addVisitorBtn.addEventListener('click', () => {
            const name = DOM.nameInput.value.trim();
            const phone = DOM.phoneInput.value.trim();
            const isFirstTime = DOM.firstTimeCheckbox.checked;
            
            if (!name || !phone) {
                alert('Por favor, preencha nome e telefone');
                return;
            }
            
            const newVisitor = {
                id: Date.now(),
                name,
                phone,
                isFirstTime,
                date: formatDate(selectedDate)
            };
            
            DataManager.addVisitor(newVisitor);
            
            // Limpar campos
            DOM.nameInput.value = '';
            DOM.phoneInput.value = '';
            DOM.firstTimeCheckbox.checked = false;
        });
        
        DOM.downloadBtn.addEventListener('click', this.downloadVisitorsList);
        
        // Fechar dropdowns ao clicar fora
        document.addEventListener('click', (e) => {
            if (!DOM.dateSelectorBtn.contains(e.target) && !DOM.datePickerDropdown.contains(e.target)) {
                DOM.datePickerDropdown.style.display = 'none';
            }
            
            if (!DOM.viewDateSelectorBtn.contains(e.target) && !DOM.viewDatePickerDropdown.contains(e.target)) {
                DOM.viewDatePickerDropdown.style.display = 'none';
            }
        });
    },
    
    downloadVisitorsList() {
        const filteredVisitors = visitors.filter(v => v.date === formatDate(viewDate));
        
        if (filteredVisitors.length === 0) {
            alert('Não há visitantes para baixar nesta data.');
            return;
        }
        
        const text = generateDownloadText(filteredVisitors);
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Visitantes_${formatDate(viewDate).replace(/\//g, '-')}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

// Função para gerar texto para download
function generateDownloadText(filteredVisitors) {
    const header = `Visitantes - ${formatDate(viewDate)}\n\n`;
    const visitorsList = filteredVisitors.map(v => 
        `Nome: ${v.name}\nTelefone: ${v.phone}\nPrimeira Vez: ${v.isFirstTime ? 'Sim' : 'Não'}\n---`
    ).join('\n');
    
    const totalStats = `\n\nTotal de Visitantes: ${filteredVisitors.length}\n` +
        `Visitantes pela Primeira Vez: ${filteredVisitors.filter(v => v.isFirstTime).length}`;
    
    return header + visitorsList + totalStats;
}

// Renderização da lista de visitantes
function renderVisitorsList() {
    // Filtrar visitantes pela data selecionada para visualização
    const filteredVisitors = visitors.filter(v => v.date === formatDate(viewDate));
    
    // Limpar lista
    DOM.visitorsList.innerHTML = '';
    
    // Adicionar visitantes à lista
    filteredVisitors.forEach(visitor => {
        const visitorItem = document.createElement('div');
        visitorItem.className = 'visitor-item';
        
        const visitorInfo = document.createElement('div');
        visitorInfo.className = 'visitor-info';
        
        const visitorName = document.createElement('div');
        visitorName.className = 'visitor-name';
        visitorName.textContent = visitor.name;
        
        const visitorPhone = document.createElement('div');
        visitorPhone.className = 'visitor-phone';
        visitorPhone.textContent = visitor.phone;
        
        visitorInfo.appendChild(visitorName);
        visitorInfo.appendChild(visitorPhone);
        
        if (visitor.isFirstTime) {
            const firstTimeBadge = document.createElement('div');
            firstTimeBadge.className = 'first-time-badge';
            firstTimeBadge.textContent = 'Primeira Vez';
            visitorInfo.appendChild(firstTimeBadge);
        }
        
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-button';
        removeButton.textContent = 'Remover';
        removeButton.addEventListener('click', () => DataManager.removeVisitor(visitor.id));
        
        visitorItem.appendChild(visitorInfo);
        visitorItem.appendChild(removeButton);
        
        DOM.visitorsList.appendChild(visitorItem);
    });
    
    // Atualizar estatísticas
    DOM.totalVisitorsCount.textContent = filteredVisitors.length;
    DOM.firstTimeVisitorsCount.textContent = filteredVisitors.filter(v => v.isFirstTime).length;
}

// Inicialização
function init() {
    UIManager.initializeDates();
    UIManager.setupEventListeners();
    ConnectionManager.init();
    DataManager.load();
}

// Iniciar aplicação
init();
