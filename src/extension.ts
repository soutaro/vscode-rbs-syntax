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
	IndentAction,
} from 'vscode';

class NewLineIndentProvider implements OnTypeFormattingEditProvider {
	matchDefOrType(line: TextLine): RegExpMatchArray | null {
		return line.text.match(/^(\s*)((def [^:]+:)|(type [^=]+=))/)
	}

	matchEmptyLine(line: TextLine): RegExpMatchArray | null {
		return line.text.match(/^\s*$/)
	}

	matchBlockDelimiter(line: TextLine): RegExpMatchArray | null {
		return line.text.match(/^\s*end$/) || line.text.match(/^\s*(class|interface|module)\b/)
	}

	indentForDefOrType(document: TextDocument, position: Position): ProviderResult<TextEdit[]> | null {
		const d = this.matchDefOrType(document.lineAt(position.line - 1))
		if (!d) return

		const indentSize = d[2].length - 1;
		const insertSpace = TextEdit.insert(position, ' '.repeat(indentSize))
		return Promise.resolve([insertSpace])
	}

	outdentToMember(document: TextDocument, position: Position): ProviderResult<TextEdit[]> | null {
		const prevLine = document.lineAt(position.line - 1)
		const empty = this.matchEmptyLine(prevLine)
		if (!empty) return

		let memberLine = position.line - 2
		while (memberLine > 0) {
			const line = document.lineAt(memberLine)

			if (this.matchBlockDelimiter(line)) {
				return
			}

			const match = this.matchDefOrType(line)
			if (match) {
				const leadingSpaces = match[1]

				if (leadingSpaces.length >= position.character) {
					return
				}

				const range = new Range(position.translate(undefined, leadingSpaces.length - position.character), position)
				const outdent = TextEdit.delete(range)
		
				return Promise.resolve([outdent])
			} else {
				memberLine--;
			}
		}
	}

	provideOnTypeFormattingEdits(document: TextDocument, position: Position, ch: string, options: FormattingOptions, token: CancellationToken): ProviderResult<TextEdit[]> {
		if (document.lineAt(position.line).text.substring(position.character).length > 0) {
			return
		}

		return this.indentForDefOrType(document, position) || this.outdentToMember(document, position)

		return
	}	
}

export function activate(context: ExtensionContext) {
	context.subscriptions.push(
		languages.registerOnTypeFormattingEditProvider(
			'ruby-signature',
			new NewLineIndentProvider(),
			"\n"
		)
	)

	context.subscriptions.push(
		languages.setLanguageConfiguration(
			"ruby-signature", 
			{
				indentationRules: {
					increaseIndentPattern: /^(\s*)(class|module|interface)\b/,
					decreaseIndentPattern: /^(\s*)end/
				},
				onEnterRules: [
					{
						beforeText: /^\s*#/,
						action: { indentAction: IndentAction.None, appendText: "# " }
					}
				]
			}
		)
	)
}

export function deactivate() {}
