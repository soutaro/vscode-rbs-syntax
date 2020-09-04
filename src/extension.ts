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
	TextLine,
} from 'vscode';

class InsertOrDeleteBarProvider implements OnTypeFormattingEditProvider {
  matchDef(line: TextLine): RegExpMatchArray | null {
		return line.text.match(/^(\s*)(def [^:]+):/)
	}

	matchBar(line: TextLine): RegExpMatchArray | null {
		return line.text.match(/^(\s*\|\s*)$/)
	}

	formatBarAfterDef(document: TextDocument, position: Position): ProviderResult<TextEdit[]> | null {
		const prevLine = document.lineAt(position.line - 1)
		const def = this.matchDef(document.lineAt(position.line - 1))
		if (!def) return

		const indentSize = def[2].length;
		const insertBar = TextEdit.insert(position, ' '.repeat(indentSize) + '| ')
		return Promise.resolve([insertBar])
	}

	formatLineAfterBar(document: TextDocument, position: Position): ProviderResult<TextEdit[]> | null {
		const prevLine = document.lineAt(position.line - 1)
		const bar = this.matchBar(prevLine)
		if (!bar) return

		const prevPrevLine = document.lineAt(position.line - 2)
		const def = this.matchDef(prevPrevLine)
		if (!def) return

		const deleteEmptyType = TextEdit.delete(prevLine.range)
		const indentRange = document.lineAt(position.line).range
		const deleteIndent = TextEdit.delete(indentRange)
		const insertIndent = TextEdit.insert(new Position(position.line, 0), ' '.repeat(def[1].length))

		return Promise.resolve([deleteEmptyType, deleteIndent, insertIndent])
	}

	provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]> {
		if (document.lineAt(position.line).text.substring(position.character).length) {
			return
		}

		return this.formatBarAfterDef(document, position) || this.formatLineAfterBar(document, position)
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
