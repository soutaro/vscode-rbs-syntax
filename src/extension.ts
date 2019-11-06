import {
	languages,
	CancellationToken,
	ExtensionContext,
	FormattingOptions,
	TextDocument,
	TextEdit,
	OnTypeFormattingEditProvider,
	Range,
	Position,
	ProviderResult,
} from 'vscode';

class InsertOrDeleteBarProvider implements OnTypeFormattingEditProvider {
	provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]> {
		if (document.lineAt(position.line).text.substring(position.character).length) {
			return
		}

		const prevLine = document.lineAt(position.line - 1)
		const def = prevLine.text.match(/^(\s*def [^:]+):/)
		if (def) {
			const indentSize = def[1].length - options.tabSize;
			const insertBar = TextEdit.insert(position, ' '.repeat(indentSize) + '| ')
			return Promise.resolve([insertBar])
		}

		if (/^(\s*\|\s*)$/.test(prevLine.text)) {
			const deleteEmptyType = TextEdit.delete(prevLine.range)
			const indentRange = document.lineAt(position.line).range
			const deleteIndent = TextEdit.delete(indentRange)
			const insertIndent = TextEdit.insert(new Position(position.line, 0), ' '.repeat(options.tabSize))
			return Promise.resolve([deleteEmptyType, deleteIndent, insertIndent])
		}
	}
}

export function activate(context: ExtensionContext) {
	context.subscriptions.push(
		languages.registerOnTypeFormattingEditProvider(
			'ruby-signature',
			new InsertOrDeleteBarProvider(),
			"\n"
		)
	)
}

export function deactivate() {}
