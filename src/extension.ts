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
	DocumentSymbolProvider,
	SymbolKind,
	DocumentSymbol,
	workspace,
	Disposable,
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
	}
}

class RbsDocumentSymbolProvider implements DocumentSymbolProvider {
	provideDocumentSymbols(document: TextDocument, token: CancellationToken): ProviderResult<DocumentSymbol[]> {
		const symbols: DocumentSymbol[] = []
		const iter = this.eachLine(document)

		while (!iter.eof()) {
			const parsed = this.parse(iter)
			symbols.push(...parsed)
		}

		return symbols
	}

	parse(iter: { next: () => TextLine | null, eof: () => boolean, prev: () => TextLine }): DocumentSymbol[] {
		const symbols: DocumentSymbol[] = []

		while (true) {
			const line = iter.next()
			if (line === null || line.text.match(/^\s*end\s*$/)) {
				break
			}

			let match: RegExpMatchArray | null
			if (match = line.text.match(/^(\s*)(class|module|interface)\s+(_?[A-Z]\w*)/)) {
				const indent = match[1]
				const kind = match[2]
				const name = match[3]

				const symKind = kind === "class" ? SymbolKind.Class : kind === "module" ? SymbolKind.Module : SymbolKind.Interface
				const selectionRange = new Range(line.range.start.translate(undefined, indent.length), line.range.end)
				const children = this.parse(iter)

				const range = new Range(line.range.start, iter.prev().range.end)
				const symbol = new DocumentSymbol(name, line.text, symKind, range, selectionRange)
				symbol.children = children
				symbols.push(symbol)
			} else if (match = line.text.match(/^(\s*)def\s*([^:]+):/)) {
				const indent = match[1]
				const name = match[2]

				const range = new Range(line.range.start.translate(undefined, indent.length), line.range.end)
				const symbol = new DocumentSymbol(name, line.text, SymbolKind.Method, range, range)
				symbols.push(symbol)
			}
		}

		return symbols
	}

	eachLine(document: TextDocument) {
		let i = 0
		let eof = false
		let prev: TextLine;

		return {
			next: () => {
				if (i < document.lineCount) {
					prev = document.lineAt(i++);
					return prev
				} else {
					eof = true;
					return null;
				}
			},
			eof: () => eof,
			prev: () => prev,
		}
	}
}

const features = {
	documentSymbolProvider: undefined as Disposable | undefined,
	onTypeFormattingEditProvider: undefined as Disposable | undefined,
}

function updateFeature(enabled: boolean, key: keyof typeof features, start: () => Disposable) {
	if (enabled) {
		if (!features[key]) {
			console.log(`Starting ${key}...`)
			features[key] = start()
		}
	} else {
		const disposable = features[key]
		if (disposable) {
			console.log(`Shutting down ${key}...`)
			disposable.dispose()
			features[key] = undefined;
		}
	}
}

function updateDocumentSymbolProvider(enabled: boolean = workspace.getConfiguration("rbs-syntax").get<boolean>("outlineView", true)) {
	updateFeature(
		enabled,
		"documentSymbolProvider",
		() => languages.registerDocumentSymbolProvider("rbs", new RbsDocumentSymbolProvider())
	)
}

function updateOnTypeFormattingProvider(enabled: boolean = workspace.getConfiguration("rbs-syntax").get<boolean>("onTypeFormatting", true)) {
	updateFeature(
		enabled,
		"onTypeFormattingEditProvider",
		() => languages.registerOnTypeFormattingEditProvider('rbs', new NewLineIndentProvider(), "\n")
	)
}


export function activate(context: ExtensionContext) {
	context.subscriptions.push(
		workspace.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration("rbs-syntax")) {
				updateDocumentSymbolProvider()
				updateOnTypeFormattingProvider()
			}
		})
	)

	updateDocumentSymbolProvider()
	updateOnTypeFormattingProvider()

	context.subscriptions.push(
		languages.setLanguageConfiguration(
			"rbs",
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

export function deactivate() {
	updateDocumentSymbolProvider(false)
	updateOnTypeFormattingProvider(false)
}
