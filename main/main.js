const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const serve = require('electron-serve');
const fs = require('fs');

const loadURL = serve.default ? serve.default({ directory: 'out' }) : serve({ directory: 'out' });

function createWindow() {
    const win = new BrowserWindow({
        width: 1000,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        backgroundColor: '#0a0a0c',
        titleBarStyle: 'hiddenInset',
    });

    if (app.isPackaged) {
        loadURL(win);
    } else {
        win.loadURL('http://localhost:3000');
    }
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

const OAuth = require('oauth-1.0a');
const CryptoJS = require('crypto-js');

// IPC handler for X API requests (to bypass CORS and works with static export)
ipcMain.handle('x-api-request', async (event, { url, token, userAuth }) => {
    try {
        let headers = {};

        if (userAuth) {
            // OAuth 1.0a Signing
            const oauth = OAuth({
                consumer: {
                    key: userAuth.apiKey,
                    secret: userAuth.apiSecret,
                },
                signature_method: 'HMAC-SHA1',
                hash_function(base_string, key) {
                    return CryptoJS.HmacSHA1(base_string, key).toString(CryptoJS.enc.Base64);
                },
            });

            const request_data = {
                url: url,
                method: 'GET',
            };

            const token_data = {
                key: userAuth.accessToken,
                secret: userAuth.accessTokenSecret,
            };

            headers = oauth.toHeader(oauth.authorize(request_data, token_data));
        } else {
            // Bearer Token
            headers = {
                Authorization: `Bearer ${token}`,
            };
        }

        const response = await fetch(url, { headers });
        const data = await response.json();
        return { status: response.status, data };
    } catch (error) {
        return { status: 500, error: error.message };
    }
});

// IPC handler for saving CSV
ipcMain.handle('save-csv', async (event, { content, filename }) => {
    const { filePath } = await dialog.showSaveDialog({
        title: 'CSVを保存',
        defaultPath: filename,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
    });

    if (filePath) {
        fs.writeFileSync(filePath, content, 'utf-8');
        return { success: true, path: filePath };
    }
    return { success: false };
});

ipcMain.handle('open-external', async (event, url) => {
    shell.openExternal(url);
});
