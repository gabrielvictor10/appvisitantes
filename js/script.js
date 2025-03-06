// Estado da aplicação
let visitors = [];
let selectedDate = new Date();
let viewDate = new Date();
let supabaseEnabled = false;
let supabase = null;

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

// Inicialização do Supabase - será definido após o carregamento da biblioteca
const supabaseUrl = 'https://qdttsbnsijllhkgrpdmc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkdHRzYm5zaWpsbGhrZ3JwZG1jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDExOTQzNDgsImV4cCI6MjA1Njc3MDM0OH0.CuZdeCC2wK73CrTt2cMIKxj20hAtgz_8qAhFt1EKkCw';

// Inicializar sistema de logs para depuração
let debugLog, toggleDebugBtn, debugPanel, syncBtn;

function initDebugSystem() {
    // Adiciona os elementos de depuração ao DOM se não existirem
    if (!document.getElementById('debugPanel')) {
        const debugPanelHTML = `
            <div id="debugPanel" style="display: none; margin-top: 20px;">
                <h3 style="margin-bottom: 8px;">Console de Depuração</h3>
                <div id="debugLog" style="background: #f1f1f1; padding: 10px; border-radius: 4px; max-height: 200px; overflow-y: auto; font-family: monospace; font-size: 12px;"></div>
                <button id="toggleDebugBtn" class="button button-outline" style="margin-top: 8px;">Mostrar Depuração</button>
            </div>
        `;
        document.querySelector('.card').insertAdjacentHTML('beforeend', debugPanelHTML);
    }
    
    // Adicionar botão de sincronização manual se não existir
    if (!document.getElementById('syncBtn')) {
        const syncBtnHTML = `
            <button id="syncBtn" class="button button-outline" style="margin-top: 8px;">
                <span class="icon">🔄</span>
                <span>Sincronizar Dados</span>
            </button>
        `;
        document.getElementById('downloadBtn').insertAdjacentHTML('afterend', syncBtnHTML);
    }
    
    debugLog = document.getElementById('debugLog');
    toggleDebugBtn = document.getElementById('toggleDebugBtn');
    debugPanel = document.getElementById('debugPanel');
    syncBtn = document.getElementById('syncBtn');
    
    // Sobrescreva console.log, console.error para exibir no painel
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = function() {
        originalLog.apply(console, arguments);
        const args = Array.from(arguments).join(' ');
        if (debugLog) {
            debugLog.innerHTML += `<div style="color: black;">[LOG] ${args}</div>`;
            debugLog.scrollTop = debugLog.scrollHeight;
        }
    };
    
    console.error = function() {
        originalError.apply(console, arguments);
        const args = Array.from(arguments).join(' ');
        if (debugLog) {
            debugLog.innerHTML += `<div style="color: red;">[ERROR] ${args}</div>`;
            debugLog.scrollTop = debugLog.scrollHeight;
        }
    };
    
    // Adicionar eventos para os botões de depuração
    toggleDebugBtn.addEventListener('click', () => {
        if (debugPanel.style.display === 'none') {
            debugPanel.style.display = 'block';
            toggleDebugBtn.textContent = 'Ocultar Depuração';
        } else {
            debugPanel.style.display = 'none';
            toggleDebugBtn.textContent = 'Mostrar Depuração';
        }
    });
    
    syncBtn.addEventListener('click', async () => {
        if (supabaseEnabled) {
            syncBtn.textContent = 'Sincronizando...';
            syncBtn.disabled = true;
            
            const success = await syncVisitorsToSupabase();
            
            if (success) {
                alert('Sincronização concluída com sucesso!');
            } else {
                alert('Erro na sincronização. Verifique o console para detalhes.');
            }
            
            syncBtn.innerHTML = '<span class="icon">🔄</span><span>Sincronizar Dados</span>';
            syncBtn.disabled = false;
        } else {
            alert('Supabase não está disponível. Verifique sua conexão com a internet.');
        }
    });
}

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

// Inicializar datas
function initializeDates() {
    selectedDate = adjustDate(new Date());
    viewDate = adjustDate(new Date());
    
    selectedDateText.textContent = `Data do Registro: ${formatDate(selectedDate)}`;
    viewDateText.textContent = `Visualizar Registros: ${formatDate(viewDate)}`;
    
    selectedDateInput.value = selectedDate.toISOString().split('T')[0];
    viewDateInput.value = viewDate.toISOString().split('T')[0];
}

// Função para testar a conexão com o Supabase
async function testSupabaseConnection() {
    console.log('Testando conexão com Supabase...');
    
    if (!window.supabase) {
        console.error('Biblioteca Supabase não carregada.');
        return false;
    }
    
    try {
        supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        
        console.log('Cliente Supabase inicializado. Testando conexão...');
        
        // Teste simples para verificar a conexão
        const { data, error } = await supabase.from('visitors').select('count()', { count: 'exact', head: true });
        
        if (error) {
            console.error('Erro ao conectar com Supabase:', error);
            return false;
        }
        
        console.log('Conexão com Supabase estabelecida com sucesso!');
        return true;
    } catch (e) {
        console.error('Falha ao inicializar cliente Supabase:', e);
        return false;
    }
}

// Inicializar tempo real para sincronismo (apenas se Supabase estiver disponível)
function initializeRealtime() {
    if (!supabaseEnabled) {
        console.log('Realtime não inicializado - Supabase não está disponível');
        return;
    }
    
    console.log('Inicializando Realtime para sincronismo...');
    
    try {
        // Inscrever-se nas mudanças da tabela visitors
        const subscription = supabase
            .channel('visitors-channel')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'visitors' }, 
                payload => {
                    console.log('Alteração Realtime detectada:', payload);
                    syncVisitorsFromSupabase(); // Sincronizar visitantes quando houver alterações
                }
            )
            .subscribe(status => {
                console.log('Status da inscrição realtime:', status);
            });
            
        console.log('Realtime inicializado com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar realtime:', error);
    }
}

// Carregar visitantes do localStorage
function loadVisitors() {
    console.log('Carregando visitantes do localStorage...');
    const savedVisitors = JSON.parse(localStorage.getItem('churchVisitors') || '[]');
    visitors = savedVisitors;
    renderVisitorsList();
    console.log(`${visitors.length} visitantes carregados do localStorage`);
    
    // Se Supabase estiver disponível, também sincroniza dados
    if (supabaseEnabled) {
        syncVisitorsFromSupabase();
    }
}

// Sincronizar visitantes do Supabase
async function syncVisitorsFromSupabase() {
    if (!supabaseEnabled) {
        console.log('Sincronização do Supabase ignorada - Supabase não disponível');
        return;
    }
    
    console.log('Sincronizando visitantes do Supabase...');
    
    try {
        // Busca todos os visitantes no Supabase
        const { data, error } = await supabase
            .from('visitors')
            .select('*');
            
        if (error) {
            console.error('Erro ao buscar visitantes do Supabase:', error);
            throw error;
        }
        
        console.log(`Recebidos ${data ? data.length : 0} visitantes do Supabase`);
        
        // Se tiver dados do Supabase
        if (data && data.length > 0) {
            // Converter formato do Supabase para o formato do localStorage
            const formattedData = data.map(visitor => ({
                id: visitor.id || Date.now(),
                name: visitor.name,
                phone: visitor.phone,
                isFirstTime: visitor.isFirstTime,
                date: visitor.date,
                created_at: visitor.created_at || new Date().toISOString(),
                updated_at: visitor.updated_at || new Date().toISOString(),
                synced: true
            }));
            
            console.log('Mesclando dados locais e remotos...');
            
            // Mescla dados do localStorage com Supabase, mantendo versões mais recentes
            const mergedVisitors = [];
            const allIds = new Set([
                ...visitors.map(v => v.id.toString()), 
                ...formattedData.map(v => v.id.toString())
            ]);
            
            allIds.forEach(id => {
                const localVisitor = visitors.find(v => v.id.toString() === id);
                const remoteVisitor = formattedData.find(v => v.id.toString() === id);
                
                if (localVisitor && remoteVisitor) {
                    // Usa timestamp para determinar qual versão é mais recente
                    const localUpdated = localVisitor.updated_at ? new Date(localVisitor.updated_at) : new Date(0);
                    const remoteUpdated = remoteVisitor.updated_at ? new Date(remoteVisitor.updated_at) : new Date(0);
                    
                    if (localUpdated > remoteUpdated && localVisitor.modified) {
                        console.log(`Visitante ${id}: usando versão local (mais recente)`);
                        // O local é mais recente e foi modificado
                        mergedVisitors.push(localVisitor);
                    } else {
                        console.log(`Visitante ${id}: usando versão remota (mais recente)`);
                        // O remoto é mais recente ou o local não foi modificado
                        mergedVisitors.push(remoteVisitor);
                    }
                } else if (localVisitor) {
                    // Registros que existem apenas localmente
                    if (localVisitor.deleted) {
                        console.log(`Visitante ${id}: ignorando (marcado como excluído)`);
                        // Se marcado como excluído, não incluir na mesclagem
                    } else {
                        console.log(`Visitante ${id}: mantendo versão local (não existe remotamente)`);
                        mergedVisitors.push(localVisitor);
                    }
                } else if (remoteVisitor) {
                    // Registros que existem apenas remotamente
                    console.log(`Visitante ${id}: adicionando versão remota (não existe localmente)`);
                    mergedVisitors.push(remoteVisitor);
                }
            });
            
            console.log(`Mesclagem concluída: ${mergedVisitors.length} visitantes após mesclagem`);
            
            visitors = mergedVisitors;
            saveVisitors(false); // Salva no localStorage, mas não reenvia para Supabase
            renderVisitorsList();
        } else {
            console.log('Nenhum visitante encontrado no Supabase ou resposta vazia');
        }
        
        return true;
    } catch (error) {
        console.error("Erro ao sincronizar com Supabase:", error);
        // Continua usando dados do localStorage em caso de erro
        return false;
    }
}

// Salvar visitantes no localStorage e opcionalmente no Supabase
function saveVisitors(syncToSupabase = true) {
    // Sempre salva no localStorage
    localStorage.setItem('churchVisitors', JSON.stringify(visitors));
    console.log(`${visitors.length} visitantes salvos no localStorage`);
    
    // Sincroniza com Supabase se habilitado e solicitado
    if (supabaseEnabled && syncToSupabase) {
        console.log('Iniciando sincronização com Supabase...');
        syncVisitorsToSupabase();
    }
}

// Sincronizar visitantes para o Supabase - FUNÇÃO OTIMIZADA
async function syncVisitorsToSupabase() {
    if (!supabaseEnabled) {
        console.log('Sincronização para Supabase ignorada - Supabase não disponível');
        return false;
    }
    
    console.log('Iniciando sincronização com Supabase...');
    
    try {
        // Verifica quais visitantes precisam ser sincronizados
        // Um visitante precisa ser sincronizado se foi modificado ou nunca foi sincronizado
        const pendingVisitors = visitors.filter(v => v.modified || !v.synced);
        const deletedVisitors = JSON.parse(localStorage.getItem('deletedVisitors') || '[]');
        
        console.log(`Encontrados ${pendingVisitors.length} visitantes para sincronizar e ${deletedVisitors.length} para excluir`);
        
        // Processa primeiro as exclusões
        if (deletedVisitors.length > 0) {
            console.log('Processando exclusões...');
            for (const deletedId of deletedVisitors) {
                console.log(`Tentando excluir visitante ID: ${deletedId}`);
                const { error: deleteError } = await supabase
                    .from('visitors')
                    .delete()
                    .eq('id', deletedId);
                
                if (deleteError) {
                    console.error(`Erro ao excluir visitante ${deletedId}:`, deleteError);
                } else {
                    console.log(`Visitante ${deletedId} excluído com sucesso`);
                }
            }
            // Limpa a lista de excluídos após processar
            localStorage.setItem('deletedVisitors', '[]');
            console.log('Lista de exclusões processada e limpa');
        }
        
        // Processa as atualizações e inserções
        if (pendingVisitors.length > 0) {
            console.log('Processando inserções/atualizações...');
            let successCount = 0;
            
            for (const visitor of pendingVisitors) {
                // Prepara o objeto para upsert, garantindo que os campos timestamp estão presentes
                const visitorToSync = {
                    ...visitor,
                    updated_at: new Date().toISOString(),
                    created_at: visitor.created_at || new Date().toISOString()
                };
                
                // Remove flags de controle interno que não devem ir para o banco
                delete visitorToSync.modified;
                delete visitorToSync.synced;
                
                console.log(`Sincronizando visitante: ${visitor.name} (ID: ${visitor.id})`);
                
                // Verifica se o registro já existe
                console.log(`Verificando se o visitante já existe no banco...`);
                const { data: existingData, error: checkError } = await supabase
                    .from('visitors')
                    .select('id')
                    .eq('id', visitor.id);
                
                if (checkError) {
                    console.error(`Erro ao verificar existência do visitante ${visitor.id}:`, checkError);
                    continue;
                }
                
                if (!existingData || existingData.length === 0) {
                    // Insere novo registro
                    console.log(`Inserindo novo visitante: ${visitor.name}`);
                    const { error: insertError } = await supabase
                        .from('visitors')
                        .insert([visitorToSync]);
                    
                    if (insertError) {
                        console.error(`Erro ao inserir visitante ${visitor.id}:`, insertError);
                    } else {
                        console.log(`Visitante ${visitor.name} inserido com sucesso`);
                        // Marca o registro como sincronizado
                        visitor.synced = true;
                        visitor.modified = false;
                        successCount++;
                    }
                } else {
                    // Atualiza registro existente
                    console.log(`Atualizando visitante existente: ${visitor.name}`);
                    const { error: updateError } = await supabase
                        .from('visitors')
                        .update(visitorToSync)
                        .eq('id', visitor.id);
                    
                    if (updateError) {
                        console.error(`Erro ao atualizar visitante ${visitor.id}:`, updateError);
                    } else {
                        console.log(`Visitante ${visitor.name} atualizado com sucesso`);
                        // Marca o registro como sincronizado
                        visitor.synced = true;
                        visitor.modified = false;
                        successCount++;
                    }
                }
            }
            
            // Atualiza o localStorage com as flags atualizadas
            localStorage.setItem('churchVisitors', JSON.stringify(visitors));
            console.log(`Sincronização concluída: ${successCount}/${pendingVisitors.length} visitantes sincronizados com sucesso`);
        } else {
            console.log('Não há visitantes pendentes para sincronizar');
        }
        
        return true;
    } catch (error) {
        console.error("Erro geral ao sincronizar com Supabase:", error);
        return false;
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
    
    const timestamp = new Date().toISOString();
    const newVisitor = {
        id: Date.now(),
        name,
        phone,
        isFirstTime,
        date: formatDate(selectedDate),
        created_at: timestamp,
        updated_at: timestamp,
        synced: false,
        modified: true
    };
    
    visitors.push(newVisitor);
    saveVisitors(); // Isso vai salvar no localStorage e sincronizar com Supabase
    console.log(`Novo visitante adicionado: ${name}`);
    
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
    console.log(`Iniciando remoção do visitante ID: ${id}`);
    
    // Encontra o visitante antes de removê-lo para verificar se está no Supabase
    const visitorToRemove = visitors.find(visitor => visitor.id === id);
    const wasInSupabase = visitorToRemove && visitorToRemove.synced;
    
    console.log(`Visitante ${visitorToRemove?.name} (ID: ${id})${wasInSupabase ? ' estava sincronizado com Supabase' : ' não estava sincronizado com Supabase'}`);
    
    // Remove do array local
    visitors = visitors.filter(visitor => visitor.id !== id);
    console.log(`Visitante removido do array local`);
    
    // Se estava sincronizado com Supabase, adiciona à lista de exclusão pendente
    if (wasInSupabase) {
        const deletedVisitors = JSON.parse(localStorage.getItem('deletedVisitors') || '[]');
        deletedVisitors.push(id);
        localStorage.setItem('deletedVisitors', JSON.stringify(deletedVisitors));
        console.log(`Visitante adicionado à lista de exclusão pendente`);
    }
    
    saveVisitors(); // Salva no localStorage
    
    // Se Supabase estiver disponível, tenta remover imediatamente
    if (supabaseEnabled && wasInSupabase) {
        console.log(`Tentando remover do Supabase imediatamente...`);
        try {
            const { error } = await supabase
                .from('visitors')
                .delete()
                .eq('id', id);
                
            if (error) {
                console.error(`Erro ao remover visitante do Supabase:`, error);
                console.log(`O item permanece na lista de exclusão pendente para tentar novamente depois`);
            } else {
                console.log(`Visitante removido do Supabase com sucesso`);
                // Se foi bem-sucedido, remove da lista de pendentes
                const deletedVisitors = JSON.parse(localStorage.getItem('deletedVisitors') || '[]');
                localStorage.setItem('deletedVisitors', JSON.stringify(
                    deletedVisitors.filter(deletedId => deletedId !== id)
                ));
                console.log(`Visitante removido da lista de exclusão pendente`);
            }
        } catch (error) {
            console.error("Erro ao remover visitante do Supabase:", error);
            console.log(`O item permanece na lista de exclusão pendente para tentar novamente depois`);
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
    
    console.log(`Renderizando ${filteredVisitors.length} visitantes para a data ${formatDate(viewDate)}`);
    
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
        
        if (visitor.isFirstTime) {
            const firstTimeBadge = document.createElement('div');
            firstTimeBadge.className = 'first-time-badge';
            firstTimeBadge.textContent = 'Primeira Vez';
            visitorInfo.appendChild(firstTimeBadge);
        }
        
        // Indica se o registro está sincronizado
        if (!visitor.synced) {
            const syncBadge = document.createElement('div');
            syncBadge.className = 'sync-badge';
            syncBadge.textContent = 'Não sincronizado';
            syncBadge.style.fontSize = '0.7em';
            syncBadge.style.color = '#999';
            visitorInfo.appendChild(syncBadge);
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

// Implementa tentativa automática de sincronização
function setupAutoSync() {
    // Tenta sincronizar a cada minuto se houver dados pendentes
    setInterval(() => {
        if (supabaseEnabled) {
            const pendingVisitors = visitors.filter(v => v.modified || !v.synced);
            const deletedVisitors = JSON.parse(localStorage.getItem('deletedVisitors') || '[]');
            
            if (pendingVisitors.length > 0 || deletedVisitors.length > 0) {
                console.log("Tentando sincronização automática...");
                syncVisitorsToSupabase();
            }
        }
    }, 60000); // Tenta a cada 1 minuto
}

// Inicializar a aplicação após o carregamento do Supabase
async function initializeApp() {
    console.log('Inicializando aplicação...');
    
    // Inicializar sistema de depuração
    initDebugSystem();
    
    // Testar se o Supabase está disponível e funcional
    if (window.supabase) {
        supabaseEnabled = await testSupabaseConnection();
    } else {
        console.log('Biblioteca Supabase não disponível, usando apenas localStorage');
        supabaseEnabled = false;
    }
    
    // Inicializa datas
    initializeDates();
    
    // Carrega visitantes (primeiro do localStorage, depois sincroniza com Supabase se disponível)
    loadVisitors();
    
    // Inicializa o acompanhamento em tempo real apenas se o Supabase estiver disponível
    if (supabaseEnabled) {
        initializeRealtime();
    }
    
    // Configura a sincronização automática
    setupAutoSync();
    
    console.log('Aplicação inicializada com sucesso');
}

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

// Clicar fora dos dropdowns fecha-os
document.addEventListener('click', (e) => {
    if (!dateSelectorBtn.contains(e.target) && !datePickerDropdown.contains(e.target)) {
        datePickerDropdown.style.display = 'none';
    }
    
    if (!viewDateSelectorBtn.contains(e.target) && !viewDatePickerDropdown.contains(e.target)) {
        viewDatePickerDropdown.style.display = 'none';
    }
});

// Adicionar evento para sincronizar quando a conectividade é recuperada
window.addEventListener('online', () => {
    if (supabaseEnabled) {
        console.log("Conexão de rede recuperada. Tentando sincronizar...");
        syncVisitorsToSupabase();
    }
});

// Inicializar aplicação
initializeDates();
initializeRealtime(); // Inicia tempo real apenas se Supabase estiver disponível
loadVisitors(); // Carrega do localStorage e sincroniza com Supabase se disponível
setupAutoSync(); // Configura sincronização automática
