import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('Congratulations, your extension "ccusage" is now active!');

    const disposable = vscode.commands.registerCommand('ccusage.helloWorld', () => {
        vscode.window.showInformationMessage('Hello World from CC Usage!');
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}