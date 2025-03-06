// Estado da aplicação
let visitors = [];
let selectedDate = new Date();
let viewDate = new Date();
let syncStatus = 'idle'; // novo: para controlar o status de sincronização

// Inicialização do Supabase
const supabaseUrl = 'https://qdttsbnsijllhkgrpdmc.supabase.co'; // Substitua pela sua URL do Supabase
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkdHRzYm5zaWpsbGhrZ3JwZG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExOTQzNDgsImV4cCI6MjA1Njc3MDM0OH0.CuZdeCC2wK73CrTt2cMIKxj20hAtgz_8qAhFt1EKkCw'; // Substitua pela sua chave pública do Supabase
const supabase = window.supabase ? window.supabase.createClient(supabaseUrl, supabaseKey) : null;
let supabaseEnabled = !!window.supabase;

// Elementos do DOM
const selectedDateText = document.getElementById('selectedDateText');
const selectedDateInput = document.getElementById('selectedDateInput');
const datePickerDropdown = document.getElementById('datePickerDropdown');
const dateSelectorBtn = document.getElementById('dateSelectorBtn');

const viewDateText = document.getElementById('viewDateText');
const viewDateInput = document.getElementById('viewDateInput');
const viewDatePickerDropdown = document.getElementById('viewDatePickerDropdown');
const viewDateSelectorBtn = document.getElementById('viewDateSelectorBtn');

const nameInput = document.getElementById('nameInput');
const phoneInput = document.getElementById('phoneInput');
const firstTimeCheckbox = document.getElementById('firstTimeCheckbox');
const addVisitorBtn = document.getElementById('addVisitorBtn');
const downloadBtn = document.getElementById('downloadBtn');
const visitorsList = document.getElementById('visitorsList');
const totalVisitorsCount = document.getElementById('totalVisitorsCount');
const firstTimeVisitorsCount = document.getElementById('firstTimeVisitorsCount');

// Criar elemento de status de sincronização
const syncStatusContainer = document.createElement('div');
syncStatusContainer.className = 'sync-status';
syncStatusContainer.style.marginBottom = '10px';
document.querySelector('.stats').insertAdjacentElement('beforebegin', syncStatusContainer);

// Criar elemento para log de sincronização
const syncLogContainer = document.createElement('div');
syncLogContainer.className = 'sync-log-container';
syncLogContainer.style.display = 'none';
syncLogContainer.style.marginTop = '10px';
syncLogContainer.style.padding = '8px';
syncLogContainer.style.backgroundColor = '#f5f5f5';
syncLogContainer.style.borderRadius = '4px';
syncLogContainer.style.maxHeight = '100px';
syncLogContainer.style.overflowY = 'auto';
syncLogContainer.style.fontSize = '12px';

const syncLog = document.createElement('div');
syncLog.className = 'sync-log';
syncLogContainer.appendChild(syncLog);

document.querySelector('.card').insertBefore(syncLogContainer, visitorsList);

// Botão para mostrar/esconder log de sincronização
const toggleLogBtn = document.createElement('button');
toggleLogBtn.textContent = 'Mostrar Log de Sincronização';
toggleLogBtn.className = 'button button-outline';
toggleLogBtn.style.fontSize = '12px';
toggleLogBtn.style.padding = '4px 8px';
toggleLogBtn.style.marginTop = '8px';
toggleLogBtn.addEventListener('click', () => {
    if (syncLogContainer.style.display === 'none') {
        syncLogContainer.style.display = 'block';
        toggleLogBtn.textContent = 'Esconder Log de Sincronização';
    } else {
        syncLogContainer.style.display = 'none';
        toggleLogBtn.textContent = 'Mostrar Log de Sincronização';
    }
});
document.querySelector('.sync-status').appendChild(toggleLogBtn);

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
    // Corrigindo o problema de fuso horário com uma abordagem mais robusta
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

// Atualizar status de sincronização
function updateSyncStatus(status, message) {
    syncStatus = status;
    
    // Limpar conteúdo anterior
    syncStatusContainer.innerHTML = '';
    
    // Adicionar ícone e mensagem baseados no status
    const statusIcon = document.createElement('span');
    statusIcon.style.marginRight = '5px';
    
    const statusMessage = document.createElement('span');
    
    // Botão para tentar novamente em caso de erro
    const retryButton = document.createElement('button');
    retryButton.textContent = 'Tentar Novamente';
    retryButton.className = 'button button-outline';
    retryButton.style.marginLeft = '10px';
    retryButton.style.padding = '2px 8px';
    retryButton.style.fontSize = '12px';
    
    switch(status) {
        case 'syncing':
            statusIcon.textContent = '🔄';
            statusMessage.textContent = 'Sincronizando com o banco de dados...';
            statusMessage.style.color = '#007bff';
            break;
        case 'success':
            statusIcon.textContent = '✅';
            statusMessage.textContent = 'Dados sincronizados com sucesso!';
            statusMessage.style.color = '#28a745';
            break;
        case 'error':
            statusIcon.textContent = '❌';
            statusMessage.textContent = 'Erro ao sincronizar: ' + message;
            statusMessage.style.color = '#dc3545';
            retryButton.addEventListener('click', () => {
                syncVisitorsToSupabase();
            });
            break;
        case 'offline':
            statusIcon.textContent = '⚠️';
            statusMessage.textContent = 'Modo offline: dados salvos localmente';
            statusMessage.style.color = '#ffc107';
            retryButton.addEventListener('click', () => {
                // Tentar conectar novamente ao Supabase
                checkSupabaseConnection();
            });
            break;
        case 'idle':
            statusIcon.textContent = '💾';
            statusMessage.textContent = supabaseEnabled ? 
                'Pronto para sincronizar com o banco de dados' : 
                'Salvando apenas localmente (Supabase não disponível)';
            statusMessage.style.color = '#6c757d';
            break;
    }
    
    syncStatusContainer.appendChild(statusIcon);
    syncStatusContainer.appendChild(statusMessage);
    
    if (status === 'error' || status === 'offline') {
        syncStatusContainer.appendChild(retryButton);
    }
    
    // Adicionar ao log
    addToSyncLog(status, message);
    
    // Adicionar botão de toggle ao lado do status
    syncStatusContainer.appendChild(toggleLogBtn);
}

// Adicionar ao log de sincronização
function addToSyncLog(status, message) {
    const timestamp = new Date().toLocaleTimeString();
    const logItem = document.createElement('div');
    
    let statusText;
    switch(status) {
        case 'syncing': statusText = '🔄 SINCRONIZANDO'; break;
        case 'success': statusText = '✅ SUCESSO'; break;
        case 'error': statusText = '❌ ERRO'; break;
        case 'offline': statusText = '⚠️ OFFLINE'; break;
        case 'idle': statusText = '💾 PRONTO'; break;
        default: statusText = status.toUpperCase();
    }
    
    logItem.innerHTML = `<strong>[${timestamp}]</strong> ${statusText}${message ? ': ' + message : ''}`;
    
    if (status === 'error') {
        logItem.style.color = '#dc3545';
    }
    
    syncLog.appendChild(logItem);
    
    // Auto-scroll para o item mais recente
    syncLogContainer.scrollTop = syncLogContainer.scrollHeight;
}

// Verificar conexão com Supabase
async function checkSupabaseConnection() {
    if (!window.supabase) {
        updateSyncStatus('offline', 'Biblioteca Supabase não carregada');
        supabaseEnabled = false;
        return false;
    }
    
    try {
        updateSyncStatus('syncing', 'Verificando conexão...');
        
        // Tenta fazer uma consulta simples para verificar a conexão
        const { data, error } = await supabase
            .from('visitors')
            .select('id')
            .limit(1);
            
        if (error) throw error;
        
        // Se chegou aqui, a conexão está funcionando
        supabaseEnabled = true;
        updateSyncStatus('success', 'Conexão estabelecida');
        return true;
    } catch (error) {
        console.error("Erro ao conectar com Supabase:", error);
        supabaseEnabled = false;
        updateSyncStatus('offline', error.message || 'Não foi possível conectar ao banco de dados');
        return false;
    }
}

// Inicializar datas
function initializeDates() {
    selectedDate = adjustDate(new Date());
    viewDate = adjustDate(new Date());
    
    selectedDateText.textContent = `Data do Registro: ${formatDate(selectedDate)}`;
    viewDateText.textContent = `Visualizar Registros: ${formatDate(viewDate)}`;
    
    selectedDateInput.value = selectedDate.toISOString().split('T')[0];
    viewDateInput.value = viewDate.toISOString().split('T')[0];
}

// Inicializar tempo real para sincronismo (apenas se Supabase estiver disponível)
function initializeRealtime() {
    if (!supabaseEnabled) {
        updateSyncStatus('offline', 'Sincronização em tempo real não disponível');
        return;
    }
    
    // Inscrever-se nas mudanças da tabela visitors
    const subscription = supabase
        .channel('visitors-channel')
        .on('postgres_changes', 
            { event: '*', schema: 'public', table: 'visitors' }, 
            payload => {
                addToSyncLog('info', `Recebido evento de alteração: ${payload.eventType}`);
                syncVisitorsFromSupabase(); // Sincronizar visitantes quando houver alterações
            }
        )
        .subscribe((status) => {
            addToSyncLog('info', `Status do canal de tempo real: ${status}`);
        });
}

// Carregar visitantes do localStorage
function loadVisitors() {
    const savedVisitors = JSON.parse(localStorage.getItem('churchVisitors') || '[]');
    visitors = savedVisitors;
    renderVisitorsList();
    
    // Se Supabase estiver disponível, também sincroniza dados
    if (supabaseEnabled) {
        syncVisitorsFromSupabase();
    } else {
        updateSyncStatus('offline', 'Usando apenas armazenamento local');
    }
}

// Sincronizar visitantes do Supabase
async function syncVisitorsFromSupabase() {
    if (!supabaseEnabled) {
        updateSyncStatus('offline', 'Sincronização do servidor não disponível');
        return;
    }
    
    try {
        updateSyncStatus('syncing', 'Baixando dados do servidor...');
        
        // Busca todos os visitantes no Supabase
        const { data, error } = await supabase
            .from('visitors')
            .select('*');
            
        if (error) throw error;
        
        // Se tiver dados do Supabase
        if (data && data.length > 0) {
            addToSyncLog('info', `Recebidos ${data.length} registros do servidor`);
            
            // Converter formato do Supabase para o formato do localStorage se necessário
            const formattedData = data.map(visitor => ({
                id: visitor.id || Date.now(),
                name: visitor.name,
                phone: visitor.phone,
                isFirstTime: visitor.isFirstTime,
                date: visitor.date
            }));
            
            // Mescla dados do localStorage com Supabase, mantendo versões mais recentes
            // Aqui estamos assumindo que IDs iguais referem-se ao mesmo registro
            const mergedVisitors = [];
            const allIds = new Set([
                ...visitors.map(v => v.id.toString()), 
                ...formattedData.map(v => v.id.toString())
            ]);
            
            allIds.forEach(id => {
                const localVisitor = visitors.find(v => v.id.toString() === id);
                const remoteVisitor = formattedData.find(v => v.id.toString() === id);
                
                if (localVisitor && remoteVisitor) {
                    // Se temos ambos, pegamos o mais recente
                    // Aqui seria ideal ter um timestamp para comparação
                    mergedVisitors.push(remoteVisitor); // Priorizando dados do servidor
                } else if (localVisitor) {
                    mergedVisitors.push(localVisitor);
                } else if (remoteVisitor) {
                    mergedVisitors.push(remoteVisitor);
                }
            });
            
            visitors = mergedVisitors;
            saveVisitors(false); // Salva no localStorage, mas não reenvia para Supabase
            renderVisitorsList();
            updateSyncStatus('success', `Sincronizados ${data.length} registros`);
        } else {
            addToSyncLog('info', 'Nenhum registro encontrado no servidor');
            updateSyncStatus('success', 'Sincronização concluída (sem novos dados)');
        }
    } catch (error) {
        console.error("Erro ao sincronizar com Supabase:", error);
        updateSyncStatus('error', error.message || 'Erro ao baixar dados do servidor');
        // Continua usando dados do localStorage em caso de erro
    }
}

// Salvar visitantes no localStorage e opcionalmente no Supabase
function saveVisitors(syncToSupabase = true) {
    // Sempre salva no localStorage
    localStorage.setItem('churchVisitors', JSON.stringify(visitors));
    
    // Sincroniza com Supabase se habilitado e solicitado
    if (supabaseEnabled && syncToSupabase) {
        syncVisitorsToSupabase();
    }
}

// Sincronizar visitantes para o Supabase
async function syncVisitorsToSupabase() {
    if (!supabaseEnabled) {
        updateSyncStatus('offline', 'Não foi possível enviar ao servidor (modo offline)');
        return;
    }
    
    try {
        updateSyncStatus('syncing', 'Enviando dados para o servidor...');
        
        if (visitors.length > 0) {
            const latestVisitor = visitors[visitors.length - 1];
            
            // Verifica se este visitante já existe no Supabase
            const { data: existingData, error: checkError } = await supabase
                .from('visitors')
                .select('id')
                .eq('id', latestVisitor.id);
                
            if (checkError) throw checkError;
            
            if (!existingData || existingData.length === 0) {
                // Se não existe, insere
                addToSyncLog('info', `Enviando novo registro: ${latestVisitor.name} (ID: ${latestVisitor.id})`);
                
                const { error: insertError } = await supabase
                    .from('visitors')
                    .insert([latestVisitor]);
                
                if (insertError) throw insertError;
                
                updateSyncStatus('success', `Visitante "${latestVisitor.name}" salvo no servidor`);
            } else {
                addToSyncLog('info', `Registro já existe no servidor (ID: ${latestVisitor.id})`);
                updateSyncStatus('success', 'Dados já sincronizados');
            }
        }
    } catch (error) {
        console.error("Erro ao sincronizar com Supabase:", error);
        updateSyncStatus('error', error.message || 'Erro ao enviar dados para o servidor');
        // Continua salvando no localStorage mesmo se falhar no Supabase
    }
}

// Adicionar novo visitante
function addVisitor() {
    const name = nameInput.value.trim();
    const phone = phoneInput.value.trim();
    const isFirstTime = firstTimeCheckbox.checked;
    
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
    
    visitors.push(newVisitor);
    addToSyncLog('info', `Novo visitante adicionado: ${name}`);
    saveVisitors(); // Isso vai salvar no localStorage e sincronizar com Supabase
    
    // Limpar campos
    nameInput.value = '';
    phoneInput.value = '';
    firstTimeCheckbox.checked = false;
    
    // Atualizar lista se a data de visualização for a mesma da inclusão
    if (formatDate(selectedDate) === formatDate(viewDate)) {
        renderVisitorsList();
    }
}

// Remover visitante
async function removeVisitor(id) {
    const visitorToRemove = visitors.find(v => v.id === id);
    const visitorName = visitorToRemove ? visitorToRemove.name : 'Desconhecido';
    
    visitors = visitors.filter(visitor => visitor.id !== id);
    addToSyncLog('info', `Removendo visitante: ${visitorName} (ID: ${id})`);
    saveVisitors(); // Salva no localStorage
    
    // Se Supabase estiver disponível, também remove lá
    if (supabaseEnabled) {
        try {
            updateSyncStatus('syncing', `Removendo visitante do servidor...`);
            
            const { error } = await supabase
                .from('visitors')
                .delete()
                .eq('id', id);
                
            if (error) throw error;
            
            updateSyncStatus('success', `Visitante removido do servidor`);
        } catch (error) {
            console.error("Erro ao remover visitante do Supabase:", error);
            updateSyncStatus('error', `Erro ao remover visitante do servidor: ${error.message}`);
            // Continua o fluxo mesmo se falhar no Supabase
        }
    }
    
    renderVisitorsList();
}

// Renderizar lista de visitantes
function renderVisitorsList() {
    // Filtrar visitantes pela data selecionada para visualização
    const filteredVisitors = visitors.filter(v => 
        v.date === formatDate(viewDate)
    );
    
    // Limpar lista
    visitorsList.innerHTML = '';
    
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
        
        // Indicador de sincronização ao lado do nome
        const syncIndicator = document.createElement('span');
        syncIndicator.className = 'sync-indicator';
        syncIndicator.style.marginLeft = '5px';
        syncIndicator.style.fontSize = '12px';
        syncIndicator.title = 'Status de sincronização';
        
        // Verificar se este registro está sincronizado no Supabase
        if (supabaseEnabled) {
            checkVisitorSyncStatus(visitor.id)
                .then(synced => {
                    syncIndicator.textContent = synced ? '✓' : '⟳';
                    syncIndicator.style.color = synced ? '#28a745' : '#ffc107';
                    syncIndicator.title = synced ? 'Sincronizado com o servidor' : 'Aguardando sincronização';
                })
                .catch(() => {
                    syncIndicator.textContent = '!';
                    syncIndicator.style.color = '#dc3545';
                    syncIndicator.title = 'Erro ao verificar sincronização';
                });
        }
        
        visitorName.appendChild(syncIndicator);
        
        if (visitor.isFirstTime) {
            const firstTimeBadge = document.createElement('div');
            firstTimeBadge.className = 'first-time-badge';
            firstTimeBadge.textContent = 'Primeira Vez';
            visitorInfo.appendChild(firstTimeBadge);
        }
        
        const removeButton = document.createElement('button');
        removeButton.className = 'remove-button';
        removeButton.textContent = 'Remover';
        removeButton.addEventListener('click', () => removeVisitor(visitor.id));
        
        visitorItem.appendChild(visitorInfo);
        visitorItem.appendChild(removeButton);
        
        visitorsList.appendChild(visitorItem);
    });
    
    // Atualizar estatísticas
    totalVisitorsCount.textContent = filteredVisitors.length;
    firstTimeVisitorsCount.textContent = filteredVisitors.filter(v => v.isFirstTime).length;
}

// Verificar status de sincronização de um visitante específico
async function checkVisitorSyncStatus(visitorId) {
    if (!supabaseEnabled) return false;
    
    try {
        const { data, error } = await supabase
            .from('visitors')
            .select('id')
            .eq('id', visitorId)
            .maybeSingle();
            
        if (error) throw error;
        
        // Se encontrou o dado no Supabase, está sincronizado
        return !!data;
    } catch (error) {
        console.error(`Erro ao verificar sincronização do visitante ${visitorId}:`, error);
        return false;
    }
}

// Verificar status da tabela no Supabase
async function checkSupabaseTable() {
    if (!supabaseEnabled) {
        updateSyncStatus('offline', 'Supabase não está habilitado');
        return;
    }
    
    try {
        updateSyncStatus('syncing', 'Verificando estrutura da tabela...');
        
        // Verificar se a tabela visitors existe
        const { data, error } = await supabase
            .from('visitors')
            .select('count()')
            .limit(1);
            
        if (error) {
            // Se o erro for relacionado à tabela não existir, tenta criar
            if (error.code === '42P01') { // código PostgreSQL para tabela não existe
                addToSyncLog('info', 'Tabela de visitantes não encontrada, tentando criar...');
                await createVisitorsTable();
            } else {
                throw error;
            }
        } else {
            addToSyncLog('info', 'Tabela de visitantes encontrada no banco de dados');
            updateSyncStatus('success', 'Banco de dados verificado com sucesso');
        }
    } catch (error) {
        console.error("Erro ao verificar tabela Supabase:", error);
        updateSyncStatus('error', error.message || 'Erro ao verificar estrutura do banco');
    }
}

// Criar tabela visitors no Supabase (via SQL)
async function createVisitorsTable() {
    try {
        // Esta função seria ideal, mas requer permissões de administrador
        // Na prática, você precisaria criar a tabela manualmente no painel do Supabase
        addToSyncLog('error', 'Criação automática de tabela não suportada');
        updateSyncStatus('error', 'Tabela "visitors" não existe no banco de dados');
    } catch (error) {
        console.error("Erro ao criar tabela:", error);
        updateSyncStatus('error', error.message || 'Erro ao criar tabela no banco de dados');
    }
}

// Gerar texto para download
function generateDownloadText() {
    const filteredVisitors = visitors.filter(v => 
        v.date === formatDate(viewDate)
    );
    
    const header = `Visitantes - ${formatDate(viewDate)}\n\n`;
    const visitorsList = filteredVisitors.map(v => 
        `Nome: ${v.name}\nTelefone: ${v.phone}\nPrimeira Vez: ${v.isFirstTime ? 'Sim' : 'Não'}\n---`
    ).join('\n');
    
    const totalStats = `\n\nTotal de Visitantes: ${filteredVisitors.length}\n` +
        `Visitantes pela Primeira Vez: ${filteredVisitors.filter(v => v.isFirstTime).length}`;
    
    return header + visitorsList + totalStats;
}

// Baixar lista como texto
function downloadVisitorsList() {
    const filteredVisitors = visitors.filter(v => 
        v.date === formatDate(viewDate)
    );
    
    if (filteredVisitors.length === 0) {
        alert('Não há visitantes para baixar nesta data.');
        return;
    }
    
    const blob = new Blob([generateDownloadText()], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Visitantes_${formatDate(viewDate).replace(/\//g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Verificar sincronização de todos visitantes
async function checkAllVisitorsSync() {
    if (!supabaseEnabled) return;
    
    try {
        updateSyncStatus('syncing', 'Verificando status de sincronização...');
        
        // Obter todos visitantes do Supabase
        const { data, error } = await supabase
            .from('visitors')
            .select('id');
            
        if (error) throw error;
        
        // Criar conjunto de IDs sincronizados
        const syncedIds = new Set(data.map(v => v.id.toString()));
        
        // Verificar quais visitantes locais não estão no servidor
        const unsyncedVisitors = visitors.filter(v => !syncedIds.has(v.id.toString()));
        
        if (unsyncedVisitors.length > 0) {
            addToSyncLog('info', `Encontrados ${unsyncedVisitors.length} registros não sincronizados`);
            
            // Perguntar se deseja sincronizar
            if (confirm(`Existem ${unsyncedVisitors.length} registros que não estão sincronizados com o servidor. Deseja sincronizá-los agora?`)) {
                syncMissingVisitors(unsyncedVisitors);
            }
        } else {
            updateSyncStatus('success', 'Todos os registros estão sincronizados');
        }
    } catch (error) {
        console.error("Erro ao verificar sincronização:", error);
        updateSyncStatus('error', error.message || 'Erro ao verificar sincronização');
    }
}

// Sincronizar visitantes que faltam no servidor
async function syncMissingVisitors(missingVisitors) {
    if (!supabaseEnabled || !missingVisitors || missingVisitors.length === 0) return;
    
    try {
        updateSyncStatus('syncing', `Sincronizando ${missingVisitors.length} registros...`);
        
        // Inserir todos os visitantes que faltam
        const { error } = await supabase
            .from('visitors')
            .insert(missingVisitors);
            
        if (error) throw error;
        
        updateSyncStatus('success', `${missingVisitors.length} registros sincronizados com sucesso`);
        renderVisitorsList(); // Atualiza a lista para mostrar indicadores de sincronização
    } catch (error) {
        console.error("Erro ao sincronizar visitantes:", error);
        updateSyncStatus('error', error.message || 'Erro ao sincronizar visitantes em lote');
    }
}

// Botão para verificar sincronização
const checkSyncBtn = document.createElement('button');
checkSyncBtn.textContent = 'Verificar Sincronização';
checkSyncBtn.className = 'button button-outline';
checkSyncBtn.style.marginLeft = '10px';
checkSyncBtn.addEventListener('click', checkAllVisitorsSync);

downloadBtn.insertAdjacentElement('afterend', checkSyncBtn);

// Event Listeners
dateSelectorBtn.addEventListener('click', () => {
    datePickerDropdown.style.display = datePickerDropdown.style.display === 'none' ? 'block' : 'none';
    viewDatePickerDropdown.style.display = 'none';
});

selectedDateInput.addEventListener('change', (e) => {
    const newDate = createDateFromString(e.target.value);
    selectedDate = newDate;
    selectedDateText.textContent = `Data do Registro: ${formatDate(selectedDate)}`;
    datePickerDropdown.style.display = 'none';
});

viewDateSelectorBtn.addEventListener('click', () => {
    viewDatePickerDropdown.style.display = viewDatePickerDropdown.style.display === 'none' ? 'block' : 'none';
    datePickerDropdown.style.display = 'none';
});

viewDateInput.addEventListener('change', (e) => {
    const newDate = createDateFromString(e.target.value);
    viewDate = newDate;
    viewDateText.textContent = `Visualizar Registros: ${formatDate(viewDate)}`;
    viewDatePickerDropdown.style.display = 'none';
    renderVisitorsList();
});

addVisitorBtn.addEventListener('click', addVisitor);
downloadBtn.addEventListener('click', downloadVisitorsList);

// Inicialização da aplicação
window.addEventListener('load', async () => {
    initializeDates();
    
    // Verificar se Supabase está disponível
    if (window.supabase) {
        const connected = await checkSupabaseConnection();
        if (connected) {
            await checkSupabaseTable();
            initializeRealtime();
        }
    } else {
        updateSyncStatus('offline', 'Biblioteca Supabase não carregada');
        supabaseEnabled = false;
    }
    
    loadVisitors();
});

// Função para forçar atualização de dados do Supabase
function forceSync() {
    if (!supabaseEnabled) {
        alert('O Supabase não está disponível para sincronização');
        return;
    }
    
    syncVisitorsFromSupabase()
        .then(() => {
            alert('Dados sincronizados com sucesso!');
        })
        .catch(error => {
            alert(`Erro ao sincronizar: ${error.message}`);
        });
}

// Adicionar botão para forçar sincronização
const forceSyncBtn = document.createElement('button');
forceSyncBtn.textContent = 'Forçar Sincronização';
forceSyncBtn.className = 'button button-outline';
forceSyncBtn.style.marginLeft = '10px';
forceSyncBtn.addEventListener('click', forceSync);

checkSyncBtn.insertAdjacentElement('afterend', forceSyncBtn);
