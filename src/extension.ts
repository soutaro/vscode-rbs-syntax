import {
	languages,
	CancellationToken,
	ExtensionContext,
	FormattingOptions,
	TextDocument,
	TextEdit,
	OnTypeFormattingEditProvider,
	Position,
	ProviderResult,
} from 'vscode';

class IndentationProvider implements OnTypeFormattingEditProvider {
	provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]> {
		if (document.lineAt(position.line).text.substring(position.character).length) {
			return
		}

		const m = document.lineAt(position.line - 1).text.match(/^(\s*def [^:]+):/);
		if (m) {
			const indentSize = m[1].length - (options.insertSpaces ? options.tabSize : 0);
			const textEvent = TextEdit.insert(position, ' '.repeat(indentSize) + '| ')
			return Promise.resolve([textEvent])
		}
	}
}

export function activate(context: ExtensionContext) {
	context.subscriptions.push(
		languages.registerOnTypeFormattingEditProvider(
			'ruby-signature',
			new IndentationProvider(),
			"\n"
		)
	)
}

export function deactivate() {}
