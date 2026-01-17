// ==================== INITIALIZATION ====================

// Check authentication on page load
window.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged((user) => {
        if (user) {
            currentUser = user;
            loadUserData();
        } else {
            showLoginScreen();
        }
    });
});

// ==================== AUTHENTICATION ====================

function handleLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginAlert');
    const loadingDiv = document.getElementById('loadingSpinner');
    const loginForm = document.getElementById('loginForm');
    
    // Clear previous messages
    errorDiv.style.display = 'none';
    errorDiv.textContent = '';
    
    if (!email || !password) {
        errorDiv.textContent = 'Please enter both email and password';
        errorDiv.style.display = 'block';
        return;
    }
    
    // Show loading spinner
    loginForm.style.display = 'none';
    loadingDiv.style.display = 'block';
    
    auth.signInWithEmailAndPassword(email, password)
        .then((userCredential) => {
            console.log('Login successful:', userCredential.user.email);
            // Firebase onAuthStateChanged will handle the rest
        })
        .catch((error) => {
            console.error('Login error:', error.message);
            errorDiv.textContent = error.message || 'Login failed. Please check your credentials.';
            errorDiv.style.display = 'block';
            loginForm.style.display = 'block';
            loadingDiv.style.display = 'none';
        });
}

function handleLogout() {
    if (confirm('Are you sure you want to sign out?')) {
        auth.signOut()
            .then(() => {
                currentUser = null;
                currentUserRole = null;
                currentUserData = null;
                showLoginScreen();
            })
            .catch((error) => {
                console.error('Logout error:', error);
            });
    }
}

function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('mainApp').style.display = 'none';
}

function hideLoginScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
}

// ==================== USER DATA ====================

function loadUserData() {
    const userId = currentUser.uid;
    
    database.ref(`users/${userId}`).once('value', (snapshot) => {
        if (snapshot.exists()) {
            currentUserData = snapshot.val();
            currentUserRole = currentUserData.role || 'rep';
            
            updateUserBadge();
            hideLoginScreen();
            loadDashboard();
            loadRepsForDropdowns();
            loadCustomersForDropdowns();
            
            // Show/hide admin tabs
            const adminTabs = document.querySelectorAll('.admin-only');
            const isAdmin = ['admin', 'owner'].includes(currentUserRole);
            adminTabs.forEach(tab => {
                tab.style.display = isAdmin ? 'block' : 'none';
            });
        } else {
            alert('User data not found. Please contact your administrator.');
            handleLogout();
        }
    });
}

function updateUserBadge() {
    document.getElementById('userDisplay').textContent = currentUserData?.name || currentUser.email;
    document.getElementById('roleDisplay').textContent = currentUserRole || 'user';
}

// ==================== TABS ====================

function switchTab(tabIndex) {
    const tabs = document.querySelectorAll('.tab');
    const contents = document.querySelectorAll('.tab-content');
    
    tabs.forEach((tab, index) => {
        tab.classList.toggle('active', index === tabIndex);
    });
    
    contents.forEach((content, index) => {
        content.classList.toggle('active', index === tabIndex);
    });
    
    // Refresh data when tab is opened
    if (tabIndex === 0) loadDashboard();
    if (tabIndex === 1) loadCustomers();
    if (tabIndex === 2) loadTasks();
    if (tabIndex === 3) loadCommissions();
}

// ==================== DASHBOARD ====================

function loadDashboard() {
    const userId = currentUser.uid;
    const isAdmin = ['admin', 'owner'].includes(currentUserRole);
    
    // Load metrics
    if (isAdmin) {
        loadAdminDashboard();
    } else {
        loadRepDashboard();
    }
    
    // Load recent activity
    loadActivityFeed();
    loadUrgentTasks();
}

function loadAdminDashboard() {
    database.ref('customers').once('value', (snapshot) => {
        const customers = snapshot.val() || {};
        const customerArray = Object.values(customers);
        
        // Total customers
        document.getElementById('metricTotalCustomers').textContent = customerArray.length;
        
        // Pipeline value
        const pipelineValue = customerArray
            .filter(c => c.status !== 'sold' && c.status !== 'not_sold')
            .reduce((sum, c) => sum + (c.estimatedValue || 0), 0);
        document.getElementById('metricPipelineValue').textContent = formatCurrency(pipelineValue);
        
        // Conversion rate (sold / total)
        const sold = customerArray.filter(c => c.status === 'sold').length;
        const conversionRate = customerArray.length > 0 ? Math.round((sold / customerArray.length) * 100) : 0;
        document.getElementById('metricConversionRate').textContent = conversionRate + '%';
        
        // Load my customers (not applicable for admin, show total instead)
        document.getElementById('metricMyCustomers').textContent = customerArray.length;
    });
}

function loadRepDashboard() {
    const userId = currentUser.uid;
    
    database.ref('customers').orderByChild('assignedRepId').equalTo(userId).once('value', (snapshot) => {
        const customers = snapshot.val() || {};
        const myCustomers = Object.values(customers);
        
        document.getElementById('metricTotalCustomers').textContent = myCustomers.length;
        document.getElementById('metricMyCustomers').textContent = myCustomers.length;
        
        // Pipeline value
        const pipelineValue = myCustomers
            .filter(c => c.status !== 'sold' && c.status !== 'not_sold')
            .reduce((sum, c) => sum + (c.estimatedValue || 0), 0);
        document.getElementById('metricPipelineValue').textContent = formatCurrency(pipelineValue);
        
        // Conversion rate
        const sold = myCustomers.filter(c => c.status === 'sold').length;
        const conversionRate = myCustomers.length > 0 ? Math.round((sold / myCustomers.length) * 100) : 0;
        document.getElementById('metricConversionRate').textContent = conversionRate + '%';
    });
}

function loadActivityFeed() {
    database.ref('activities').orderByChild('createdAt').limitToLast(10).once('value', (snapshot) => {
        const activities = snapshot.val() || {};
        const feedDiv = document.getElementById('activityFeed');
        
        if (Object.keys(activities).length === 0) {
            feedDiv.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">No activity yet</p>';
            return;
        }
        
        const activityArray = Object.values(activities).reverse();
        feedDiv.innerHTML = activityArray.map(activity => `
            <div style="padding: 12px; border-bottom: 1px solid #e2e8f0;">
                <p style="color: #1e293b; font-weight: 600; margin-bottom: 4px;">${activity.title}</p>
                <p style="color: #64748b; font-size: 12px; margin-bottom: 4px;">${activity.description}</p>
                <p style="color: #94a3b8; font-size: 11px;">${new Date(activity.createdAt).toLocaleString()}</p>
            </div>
        `).join('');
    });
}

function loadUrgentTasks() {
    const userId = currentUser.uid;
    
    database.ref('tasks').once('value', (snapshot) => {
        const tasks = snapshot.val() || {};
        const tasksArray = Object.entries(tasks);
        
        // Filter urgent tasks
        const now = new Date();
        const urgent = tasksArray
            .filter(([id, task]) => {
                if (task.status === 'completed') return false;
                if (task.assignedRepId && task.assignedRepId !== userId) return false;
                const dueDate = new Date(task.dueDate);
                const daysUntilDue = Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24));
                return daysUntilDue <= 1;
            })
            .map(([id, task]) => ({ id, ...task }));
        
        const tasksDiv = document.getElementById('urgentTasks');
        
        if (urgent.length === 0) {
            tasksDiv.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">No urgent tasks</p>';
            return;
        }
        
        tasksDiv.innerHTML = urgent.map(task => `
            <div style="padding: 12px; border-left: 4px solid #ef4444; background: #fee2e2; margin-bottom: 8px; border-radius: 4px;">
                <p style="color: #991b1b; font-weight: 600; margin-bottom: 4px;">⚠️ ${task.title}</p>
                <p style="color: #991b1b; font-size: 14px;">Due: ${new Date(task.dueDate).toLocaleDateString()}</p>
            </div>
        `).join('');
    });
}

// ==================== CUSTOMERS ====================

function createNewCustomer() {
    const name = document.getElementById('newCustomerName').value.trim();
    const email = document.getElementById('newCustomerEmail').value.trim();
    const mobile = document.getElementById('newCustomerMobile').value.trim();
    const postcode = document.getElementById('newCustomerPostcode').value.trim();
    const address = document.getElementById('newCustomerAddress').value.trim();
    const propertyType = document.getElementById('newCustomerPropertyType').value;
    const heatingSystem = document.getElementById('newCustomerHeatingSystem').value;
    const notes = document.getElementById('newCustomerNotes').value.trim();
    const repId = document.getElementById('newCustomerRepSelect').value;
    const installationType = document.getElementById('newCustomerInstallationType').value;
    
    if (!name || !email || !mobile || !postcode) {
        alert('Please fill in all required fields (Name, Email, Mobile, Postcode)');
        return;
    }
    
    const customerId = database.ref('customers').push().key;
    const estimatedValue = getEstimatedValue(installationType);
    
    const customerData = {
        id: customerId,
        name,
        email,
        mobile,
        postcode,
        address: address || '',
        propertyType,
        heatingSystem,
        installationType,
        estimatedValue,
        notes,
        status: 'enquiry',
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        lastContacted: new Date().toISOString(),
        assignedRepId: repId || null,
        assignedRepName: repId ? getRep Name(repId) : null
    };
    
    // Check BUS Grant eligibility
    if (heatingSystem === 'gas_boiler' || heatingSystem === 'oil_boiler') {
        customerData.busGrantEligible = true;
    } else {
        customerData.busGrantEligible = false;
    }
    
    database.ref(`customers/${customerId}`).set(customerData)
        .then(() => {
            alert('Customer created successfully!');
            
            // Create welcome call task if rep assigned
            if (repId) {
                createAutoTask(customerId, repId, 'welcome_call', 'Welcome Call', new Date());
            }
            
            // Log activity
            logActivity(`New customer: ${name}`, `Created by ${currentUserData.name}`);
            
            // Clear form
            document.getElementById('newCustomerName').value = '';
            document.getElementById('newCustomerEmail').value = '';
            document.getElementById('newCustomerMobile').value = '';
            document.getElementById('newCustomerPostcode').value = '';
            document.getElementById('newCustomerAddress').value = '';
            document.getElementById('newCustomerNotes').value = '';
            document.getElementById('newCustomerRepSelect').value = '';
            document.getElementById('newCustomerInstallationType').value = '';
            
            loadCustomers();
        })
        .catch((error) => {
            console.error('Error creating customer:', error);
            alert('Error creating customer: ' + error.message);
        });
}

function loadCustomers() {
    const userId = currentUser.uid;
    const isAdmin = ['admin', 'owner'].includes(currentUserRole);
    
    const query = isAdmin 
        ? database.ref('customers')
        : database.ref('customers').orderByChild('assignedRepId').equalTo(userId);
    
    query.once('value', (snapshot) => {
        const customers = snapshot.val() || {};
        displayCustomersTable(customers);
    });
}

function displayCustomersTable(customersObj) {
    const tableDiv = document.getElementById('customersList');
    
    if (Object.keys(customersObj).length === 0) {
        tableDiv.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">No customers yet</p>';
        return;
    }
    
    const customers = Object.values(customersObj);
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Postcode</th>
                    <th>Status</th>
                    <th>Rep</th>
                    <th>Est. Value</th>
                    <th>Days Old</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    customers.forEach(customer => {
        const daysOld = Math.floor((new Date() - new Date(customer.createdAt)) / (1000 * 60 * 60 * 24));
        const trafficLight = getTrafficLight(new Date(customer.lastContacted || customer.createdAt));
        
        html += `
            <tr>
                <td><strong>${customer.name}</strong></td>
                <td>
                    <div style="font-size: 12px;">📧 ${customer.email}</div>
                    <div style="font-size: 12px;">📱 ${customer.mobile}</div>
                </td>
                <td>${customer.postcode}</td>
                <td><span class="status-badge status-${customer.status}">${formatStatus(customer.status)}</span></td>
                <td>${customer.assignedRepName || '—'}</td>
                <td>${formatCurrency(customer.estimatedValue || 0)}</td>
                <td>${daysOld}d</td>
                <td>
                    <button class="btn btn-secondary" onclick="viewCustomerDetail('${customer.id}')" style="width: 100%; padding: 6px; font-size: 12px;">View</button>
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    tableDiv.innerHTML = html;
}

function filterCustomers() {
    const search = document.getElementById('searchCustomer').value.toLowerCase();
    const status = document.getElementById('filterStatus').value;
    
    const userId = currentUser.uid;
    const isAdmin = ['admin', 'owner'].includes(currentUserRole);
    
    const query = isAdmin 
        ? database.ref('customers')
        : database.ref('customers').orderByChild('assignedRepId').equalTo(userId);
    
    query.once('value', (snapshot) => {
        let customers = snapshot.val() || {};
        customers = Object.values(customers);
        
        // Filter by search term
        if (search) {
            customers = customers.filter(c => 
                c.name.toLowerCase().includes(search) ||
                c.email.toLowerCase().includes(search) ||
                c.mobile.includes(search)
            );
        }
        
        // Filter by status
        if (status) {
            customers = customers.filter(c => c.status === status);
        }
        
        const customersObj = {};
        customers.forEach(c => {
            customersObj[c.id] = c;
        });
        
        displayCustomersTable(customersObj);
    });
}

function viewCustomerDetail(customerId) {
    database.ref(`customers/${customerId}`).once('value', (snapshot) => {
        const customer = snapshot.val();
        if (!customer) {
            alert('Customer not found');
            return;
        }
        
        // This will be expanded in Phase 5 - for now, just show basic details
        alert(`
Customer: ${customer.name}
Email: ${customer.email}
Mobile: ${customer.mobile}
Status: ${formatStatus(customer.status)}
Est. Value: ${formatCurrency(customer.estimatedValue || 0)}

(Full detail view coming in Phase 5 - CRM Hub)
        `);
    });
}

function getRepName(repId) {
    // This will be loaded from database
    let repName = 'Unknown';
    database.ref(`reps/${repId}/name`).once('value', (snapshot) => {
        if (snapshot.exists()) {
            repName = snapshot.val();
        }
    });
    return repName;
}

function getEstimatedValue(installationType) {
    const values = {
        'heat_pump': 12000,
        'solar': 15000,
        'battery': 8000,
        'heat_pump_solar': 25000,
        'heat_pump_solar_battery': 35000,
        'mvhr': 5000,
        'green_build': 50000
    };
    return values[installationType] || 0;
}

// ==================== REPS ====================

function loadRepsForDropdowns() {
    database.ref('reps').once('value', (snapshot) => {
        const reps = snapshot.val() || {};
        const repSelect = document.getElementById('newCustomerRepSelect');
        const taskRepSelect = document.getElementById('taskRepSelect');
        
        repSelect.innerHTML = '<option value="">Admin will assign</option>';
        taskRepSelect.innerHTML = '<option value="">Select rep...</option>';
        
        Object.entries(reps).forEach(([repId, rep]) => {
            const option = document.createElement('option');
            option.value = repId;
            option.textContent = `${rep.name} (${rep.region})`;
            
            repSelect.appendChild(option);
            taskRepSelect.appendChild(option.cloneNode(true));
        });
    });
}

function addNewRep() {
    const name = document.getElementById('repName').value.trim();
    const email = document.getElementById('repEmail').value.trim();
    const mobile = document.getElementById('repMobile').value.trim();
    const password = document.getElementById('repPassword').value.trim();
    const region = document.getElementById('repRegion').value;
    const postcodes = document.getElementById('repPostcodes').value.trim();
    const maxTravelTime = parseFloat(document.getElementById('repMaxTravelTime').value) || 0;
    const maxTravelMiles = parseFloat(document.getElementById('repMaxTravelMiles').value) || 0;
    const googleCalendarId = document.getElementById('repGoogleCalendarId').value.trim();
    
    if (!name || !email || !mobile || !password || !region) {
        alert('Please fill in all required fields');
        return;
    }
    
    // Create auth account first
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const repId = userCredential.user.uid;
            
            // Create rep profile
            const repData = {
                id: repId,
                email,
                name,
                mobile,
                region,
                postcodes: postcodes.split(',').map(p => p.trim()),
                maxTravelTime,
                maxTravelMiles,
                googleCalendarId,
                role: 'rep',
                status: 'active',
                createdAt: new Date().toISOString(),
                createdBy: currentUser.uid
            };
            
            database.ref(`users/${repId}`).set(repData)
                .then(() => {
                    database.ref(`reps/${repId}`).set(repData)
                        .then(() => {
                            alert(`Rep added successfully!\nEmail: ${email}\nTemp Password: ${password}\n\nRep should change password on first login.`);
                            
                            // Clear form
                            document.getElementById('repName').value = '';
                            document.getElementById('repEmail').value = '';
                            document.getElementById('repMobile').value = '';
                            document.getElementById('repPassword').value = '';
                            document.getElementById('repRegion').value = '';
                            document.getElementById('repPostcodes').value = '';
                            document.getElementById('repMaxTravelTime').value = '';
                            document.getElementById('repMaxTravelMiles').value = '';
                            document.getElementById('repGoogleCalendarId').value = '';
                            
                            loadRepsForDropdowns();
                            loadRepsList();
                            
                            // Log activity
                            logActivity(`New rep added: ${name}`, `Region: ${region}`);
                        });
                });
        })
        .catch((error) => {
            console.error('Error adding rep:', error);
            alert('Error adding rep: ' + error.message);
        });
}

function loadRepsList() {
    database.ref('reps').once('value', (snapshot) => {
        const reps = snapshot.val() || {};
        const repsDiv = document.getElementById('repsList');
        
        if (Object.keys(reps).length === 0) {
            repsDiv.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">No reps yet</p>';
            return;
        }
        
        let html = '<table><thead><tr><th>Name</th><th>Email</th><th>Mobile</th><th>Region</th><th>Status</th><th>Actions</th></tr></thead><tbody>';
        
        Object.entries(reps).forEach(([repId, rep]) => {
            html += `
                <tr>
                    <td><strong>${rep.name}</strong></td>
                    <td>${rep.email}</td>
                    <td>${rep.mobile}</td>
                    <td>${rep.region}</td>
                    <td><span class="status-badge" style="background: #dcfce7; color: #166534;">${rep.status || 'active'}</span></td>
                    <td>
                        <button class="btn btn-secondary" onclick="editRep('${repId}')" style="width: 100%; padding: 6px; font-size: 12px;">Edit</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        repsDiv.innerHTML = html;
    });
}

// ==================== TASKS ====================

function createAutoTask(customerId, repId, taskType, title, dueDate) {
    const taskId = database.ref('tasks').push().key;
    
    const descriptions = {
        'welcome_call': 'Call customer to introduce yourself and discuss their requirements',
        'bus_grant': 'Submit BUS grant application for eligible properties',
        'book_heat_loss': 'Schedule heat loss survey with customer',
        'complete_heat_loss': 'Complete heat loss survey and analysis',
        'generate_quote': 'Generate and send quotation to customer',
        'book_installation': 'Schedule installation date with customer',
        'complete_installation': 'Complete installation and obtain customer sign-off'
    };
    
    const taskData = {
        id: taskId,
        customerId,
        assignedRepId: repId,
        type: taskType,
        title,
        description: descriptions[taskType] || '',
        status: 'not_started',
        dueDate: new Date(dueDate || new Date().getTime() + 86400000).toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: 'system',
        notes: ''
    };
    
    return database.ref(`tasks/${taskId}`).set(taskData);
}

function createTask() {
    const customerId = document.getElementById('taskCustomerSelect').value;
    const taskType = document.getElementById('taskTypeSelect').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const repId = document.getElementById('taskRepSelect').value;
    const description = document.getElementById('taskDescription').value.trim();
    
    if (!customerId || !taskType || !dueDate || !repId) {
        alert('Please fill in all required fields');
        return;
    }
    
    const taskId = database.ref('tasks').push().key;
    
    const taskData = {
        id: taskId,
        customerId,
        assignedRepId: repId,
        type: taskType,
        title: document.getElementById('taskTypeSelect').options[document.getElementById('taskTypeSelect').selectedIndex].text,
        description,
        status: 'not_started',
        dueDate: new Date(dueDate).toISOString(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid,
        notes: ''
    };
    
    database.ref(`tasks/${taskId}`).set(taskData)
        .then(() => {
            alert('Task created successfully!');
            
            // Clear form
            document.getElementById('taskCustomerSelect').value = '';
            document.getElementById('taskTypeSelect').value = '';
            document.getElementById('taskDueDate').value = '';
            document.getElementById('taskRepSelect').value = '';
            document.getElementById('taskDescription').value = '';
            
            // Notify rep
            notifyRepNewTask(repId, taskId);
            
            loadTasks();
        })
        .catch((error) => {
            console.error('Error creating task:', error);
            alert('Error creating task: ' + error.message);
        });
}

function loadTasks() {
    const userId = currentUser.uid;
    const isAdmin = ['admin', 'owner'].includes(currentUserRole);
    
    const query = isAdmin
        ? database.ref('tasks')
        : database.ref('tasks').orderByChild('assignedRepId').equalTo(userId);
    
    query.once('value', (snapshot) => {
        const tasks = snapshot.val() || {};
        displayTasks(tasks);
    });
}

function displayTasks(tasksObj) {
    const tasksDiv = document.getElementById('myTasksList');
    
    if (Object.keys(tasksObj).length === 0) {
        tasksDiv.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">No tasks yet</p>';
        return;
    }
    
    const tasks = Object.values(tasksObj);
    const now = new Date();
    
    // Sort by due date
    tasks.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
    
    let html = '<table><thead><tr><th>Task</th><th>Customer</th><th>Due Date</th><th>Status</th><th>Priority</th><th>Actions</th></tr></thead><tbody>';
    
    tasks.forEach(task => {
        const dueDate = new Date(task.dueDate);
        const isOverdue = dueDate < now && task.status !== 'completed';
        const priority = isOverdue ? 'Overdue' : Math.ceil((dueDate - now) / (1000 * 60 * 60 * 24)) <= 1 ? 'Urgent' : 'Normal';
        
        html += `
            <tr style="background-color: ${isOverdue ? '#fee2e2' : ''};">
                <td><strong>${task.title}</strong></td>
                <td>${task.customerId}</td>
                <td>${dueDate.toLocaleDateString()}</td>
                <td><span class="status-badge" style="background: #dbeafe; color: #1e40af;">${task.status}</span></td>
                <td><strong>${priority}</strong></td>
                <td>
                    <button class="btn btn-secondary" onclick="completeTask('${task.id}')" style="width: 100%; padding: 6px; font-size: 12px;">Mark Done</button>
                </td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    tasksDiv.innerHTML = html;
}

function completeTask(taskId) {
    database.ref(`tasks/${taskId}/status`).set('completed')
        .then(() => {
            database.ref(`tasks/${taskId}/completedAt`).set(new Date().toISOString());
            loadTasks();
            loadDashboard();
        });
}

// ==================== COMMISSIONS ====================

function markDepositReceived(customerId, amount) {
    const now = new Date().toISOString();
    
    database.ref(`customers/${customerId}`).once('value', (snapshot) => {
        const customer = snapshot.val();
        if (!customer) return;
        
        const repId = customer.assignedRepId;
        const totalSalePrice = amount;
        const commissionAmount = totalSalePrice * 0.05; // 5%
        const depositCommission = commissionAmount * 0.5; // 50% of 5%
        
        // Update customer
        database.ref(`customers/${customerId}`).update({
            depositReceived: true,
            depositReceivedDate: now,
            depositAmount: amount,
            status: 'sold'
        });
        
        // Create commission record
        const commissionId = database.ref('commissions').push().key;
        const commissionData = {
            id: commissionId,
            customerId,
            repId,
            totalSalePrice,
            commissionAmount,
            depositCommission,
            finalCommission: commissionAmount * 0.5,
            depositPaid: true,
            depositPaidDate: now,
            finalPaid: false,
            createdAt: now
        };
        
        database.ref(`commissions/${commissionId}`).set(commissionData);
        
        // Notify rep
        sendNotificationEmail(repId, `Commission Alert: Deposit Received`, `
            Congratulations! Deposit received for ${customer.name}.
            
            Sale Value: £${totalSalePrice.toFixed(2)}
            Your Commission (5% total): £${commissionAmount.toFixed(2)}
            
            50% now due to you: £${depositCommission.toFixed(2)}
            Payment date: End of week ${new Date(now).toLocaleDateString()}
            
            Remaining 50% due when installation completed.
        `);
        
        logActivity(`Deposit received: ${customer.name}`, `Amount: £${amount}, Commission: £${depositCommission.toFixed(2)}`);
    });
}

function markInstallationComplete(customerId) {
    const now = new Date().toISOString();
    
    database.ref(`customers/${customerId}`).once('value', (snapshot) => {
        const customer = snapshot.val();
        if (!customer) return;
        
        const repId = customer.assignedRepId;
        
        // Update customer
        database.ref(`customers/${customerId}`).update({
            installationCompletedDate: now,
            status: 'installed'
        });
        
        // Find and update commission
        database.ref('commissions').orderByChild('customerId').equalTo(customerId).once('value', (snapshot) => {
            const commissions = snapshot.val() || {};
            
            Object.entries(commissions).forEach(([commId, comm]) => {
                if (!comm.finalPaid) {
                    const finalCommission = comm.finalCommission;
                    
                    database.ref(`commissions/${commId}`).update({
                        finalPaid: true,
                        finalPaidDate: now
                    });
                    
                    // Notify rep
                    sendNotificationEmail(repId, `Ready to Invoice: Final Commission Available`, `
                        Installation completed for ${customer.name}.
                        
                        Total Commission: £${comm.commissionAmount.toFixed(2)}
                        First payment (deposit): £${comm.depositCommission.toFixed(2)} (already paid)
                        Final payment due: £${finalCommission.toFixed(2)}
                        
                        Click below to generate final invoice.
                    `);
                }
            });
        });
        
        logActivity(`Installation completed: ${customer.name}`, `Final commission ready to invoice`);
    });
}

function loadCommissions() {
    const userId = currentUser.uid;
    const isAdmin = ['admin', 'owner'].includes(currentUserRole);
    
    const query = isAdmin
        ? database.ref('commissions')
        : database.ref('commissions').orderByChild('repId').equalTo(userId);
    
    query.once('value', (snapshot) => {
        const commissions = snapshot.val() || {};
        displayCommissions(commissions, userId, isAdmin);
    });
}

function displayCommissions(commissionsObj, userId, isAdmin) {
    const commissionsDiv = document.getElementById('commissionList');
    
    if (Object.keys(commissionsObj).length === 0) {
        commissionsDiv.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">No commissions yet</p>';
        return;
    }
    
    const commissions = Object.values(commissionsObj);
    
    // Calculate totals
    let totalCommission = 0;
    let pendingCommission = 0;
    let completedCommission = 0;
    
    commissions.forEach(comm => {
        totalCommission += comm.commissionAmount || 0;
        if (!comm.finalPaid) {
            pendingCommission += comm.finalCommission || 0;
        } else {
            completedCommission += comm.commissionAmount || 0;
        }
    });
    
    document.getElementById('commissionTotal').textContent = formatCurrency(totalCommission);
    document.getElementById('commissionPending').textContent = formatCurrency(pendingCommission);
    document.getElementById('commissionMonth').textContent = formatCurrency(completedCommission);
    
    let html = '<table><thead><tr><th>Customer</th><th>Sale Price</th><th>Total Commission (5%)</th><th>Deposit (50%)</th><th>Final (50%)</th><th>Status</th></tr></thead><tbody>';
    
    commissions.forEach(comm => {
        const status = !comm.depositPaid ? 'Awaiting Deposit' : !comm.finalPaid ? 'Awaiting Installation' : 'Complete';
        const statusColor = status === 'Complete' ? '#dcfce7' : status === 'Awaiting Installation' ? '#fef3c7' : '#fee2e2';
        const statusTextColor = status === 'Complete' ? '#166534' : status === 'Awaiting Installation' ? '#92400e' : '#991b1b';
        
        html += `
            <tr>
                <td><strong>${comm.customerId}</strong></td>
                <td>${formatCurrency(comm.totalSalePrice || 0)}</td>
                <td><strong>${formatCurrency(comm.commissionAmount || 0)}</strong></td>
                <td>${formatCurrency(comm.depositCommission || 0)} ${comm.depositPaid ? '✅' : '⏳'}</td>
                <td>${formatCurrency(comm.finalCommission || 0)} ${comm.finalPaid ? '✅' : '⏳'}</td>
                <td><span class="status-badge" style="background: ${statusColor}; color: ${statusTextColor};">${status}</span></td>
            </tr>
        `;
    });
    
    html += '</tbody></table>';
    commissionsDiv.innerHTML = html;
}

// ==================== USER MANAGEMENT ====================

function createNewUser() {
    const name = document.getElementById('newUserName').value.trim();
    const email = document.getElementById('newUserEmail').value.trim();
    const password = document.getElementById('newUserPassword').value.trim();
    const role = document.getElementById('newUserRole').value;
    
    if (!name || !email || !password || !role) {
        alert('Please fill in all fields');
        return;
    }
    
    // Create Firebase Auth account
    auth.createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const userId = userCredential.user.uid;
            
            const userData = {
                id: userId,
                email,
                name,
                role,
                status: 'active',
                createdAt: new Date().toISOString(),
                createdBy: currentUser.uid
            };
            
            database.ref(`users/${userId}`).set(userData)
                .then(() => {
                    alert(`User created successfully!\nEmail: ${email}\nTemp Password: ${password}\n\nUser should change password on first login.`);
                    
                    // Clear form
                    document.getElementById('newUserName').value = '';
                    document.getElementById('newUserEmail').value = '';
                    document.getElementById('newUserPassword').value = '';
                    document.getElementById('newUserRole').value = 'rep';
                    
                    loadUsersList();
                });
        })
        .catch((error) => {
            console.error('Error creating user:', error);
            alert('Error creating user: ' + error.message);
        });
}

function loadUsersList() {
    database.ref('users').once('value', (snapshot) => {
        const users = snapshot.val() || {};
        const usersDiv = document.getElementById('usersList');
        
        if (Object.keys(users).length === 0) {
            usersDiv.innerHTML = '<p style="color: #94a3b8; text-align: center; padding: 20px;">No users yet</p>';
            return;
        }
        
        let html = '<table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Created</th><th>Actions</th></tr></thead><tbody>';
        
        Object.entries(users).forEach(([userId, user]) => {
            const createdDate = new Date(user.createdAt).toLocaleDateString();
            
            html += `
                <tr>
                    <td><strong>${user.name || 'N/A'}</strong></td>
                    <td>${user.email}</td>
                    <td><span class="status-badge" style="background: #ddd6fe; color: #4c1d95;">${user.role}</span></td>
                    <td><span class="status-badge" style="background: #dcfce7; color: #166534;">${user.status || 'active'}</span></td>
                    <td>${createdDate}</td>
                    <td>
                        <button class="btn btn-secondary" onclick="editUser('${userId}')" style="width: 100%; padding: 6px; font-size: 12px;">Edit</button>
                    </td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        usersDiv.innerHTML = html;
    });
}

function changePassword() {
    const current = document.getElementById('currentPassword').value;
    const newPass = document.getElementById('newPassword').value;
    const confirm = document.getElementById('confirmPassword').value;
    
    if (!current || !newPass || !confirm) {
        alert('Please fill in all password fields');
        return;
    }
    
    if (newPass !== confirm) {
        alert('New passwords do not match');
        return;
    }
    
    if (newPass.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    // Re-authenticate user
    const credential = firebase.auth.EmailAuthProvider.credential(currentUser.email, current);
    
    currentUser.reauthenticateWithCredential(credential)
        .then(() => {
            // Update password
            currentUser.updatePassword(newPass)
                .then(() => {
                    alert('Password changed successfully!');
                    document.getElementById('currentPassword').value = '';
                    document.getElementById('newPassword').value = '';
                    document.getElementById('confirmPassword').value = '';
                })
                .catch((error) => {
                    alert('Error changing password: ' + error.message);
                });
        })
        .catch((error) => {
            alert('Current password is incorrect: ' + error.message);
        });
}

function loadCustomersForDropdowns() {
    database.ref('customers').once('value', (snapshot) => {
        const customers = snapshot.val() || {};
        const customerSelect = document.getElementById('taskCustomerSelect');
        
        customerSelect.innerHTML = '<option value="">Select customer...</option>';
        
        Object.entries(customers).forEach(([customerId, customer]) => {
            const option = document.createElement('option');
            option.value = customerId;
            option.textContent = customer.name;
            customerSelect.appendChild(option);
        });
    });
}

// ==================== UTILITY FUNCTIONS ====================

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-GB', {
        style: 'currency',
        currency: 'GBP'
    }).format(amount);
}

function formatStatus(status) {
    const statusMap = {
        'enquiry': 'Initial Enquiry',
        'qualified': 'Qualified',
        'booked': 'Survey Booked',
        'visited': 'Visited',
        'sold': 'Sold',
        'not_sold': 'Not Sold',
        'installed': 'Installed'
    };
    return statusMap[status] || status;
}

function getTrafficLight(lastContactedDate) {
    const now = new Date();
    const daysAgo = (now - lastContactedDate) / (1000 * 60 * 60 * 24);
    
    if (daysAgo <= 2) return 'green';
    if (daysAgo <= 5) return 'yellow';
    if (daysAgo <= 12) return 'orange';
    if (daysAgo <= 20) return 'red';
    return 'black';
}

function logActivity(title, description) {
    const activityId = database.ref('activities').push().key;
    const activityData = {
        id: activityId,
        title,
        description,
        createdAt: new Date().toISOString(),
        createdBy: currentUser.uid
    };
    
    database.ref(`activities/${activityId}`).set(activityData);
}

function notifyRepNewTask(repId, taskId) {
    // This will be enhanced with email integration in Phase 3
    console.log(`Notification: New task ${taskId} assigned to rep ${repId}`);
}

function sendNotificationEmail(repId, subject, message) {
    // This will be integrated with SendGrid/Gmail API in Phase 3
    console.log(`Email to rep ${repId}: ${subject}`);
    console.log(message);
}

// ==================== INITIALIZATION ====================

// Load reps list on page load for settings tab
document.addEventListener('DOMContentLoaded', () => {
    // Initial setup will be handled by loadUserData()
});
