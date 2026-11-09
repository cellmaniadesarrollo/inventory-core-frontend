import { Component, effect, input, model, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Observable, catchError, debounceTime, of, switchMap, tap } from 'rxjs';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-autocomplete',
  styleUrl: './autocomplete.css',
  templateUrl: './autocomplete.html',
})
export class Autocomplete<T extends { id: string | number }> {
  readonly searchFn = input.required<(term: string) => Observable<T[]>>();
  readonly label = input.required<(item: T) => string>();
  readonly sublabel = input<(item: T) => string>(() => '');
  readonly placeholder = input('Buscar...');
  readonly ariaLabel = input('Buscar');
  /** Si se define, aparece "+ texto" al final de la lista y emite createClicked */
  readonly createLabel = input<string | null>(null);
  readonly invalid = input(false);

  /** Si es true, al elegir un resultado se emite `picked` y el input se limpia (para ir agregando varios) */
  readonly clearOnSelect = input(false);
  readonly picked = output<T>();

  readonly value = model<T | null>(null);
  readonly createClicked = output<void>();

  readonly text = new FormControl('', { nonNullable: true });
  readonly open = signal(false);
  readonly loading = signal(false);
  readonly results = signal<T[]>([]);
  readonly active = signal(-1);

  constructor() {
    this.text.valueChanges
      .pipe(
        debounceTime(300),
        tap(() => this.loading.set(true)),
        switchMap(term =>
          this.searchFn()(term.trim()).pipe(catchError(() => of([] as T[]))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(items => {
        this.results.set(items);
        this.active.set(items.length ? 0 : -1);
        this.loading.set(false);
      });

    // Si el padre asigna un valor (por ejemplo, un proveedor recién creado), se muestra en el input
    effect(() => {
      const v = this.value();
      if (v) this.text.setValue(this.label()(v), { emitEvent: false });
    });
  }

  onFocus() {
    this.open.set(true);
    if (!this.value()) this.text.setValue(this.text.value); // fuerza la búsqueda inicial
  }

  onInput() {
    if (this.value()) this.value.set(null); // al escribir se descarta la selección
    this.open.set(true);
  }

  select(item: T) {
    if (this.clearOnSelect()) {
      this.picked.emit(item);
      this.text.setValue('', { emitEvent: false });
      this.open.set(false);
      return;
    }
    this.value.set(item);
    this.text.setValue(this.label()(item), { emitEvent: false });
    this.open.set(false);
  }

  clear() {
    this.value.set(null);
    this.text.setValue('', { emitEvent: false });
  }

  create() {
    this.open.set(false);
    this.createClicked.emit();
  }

  onKey(e: KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.open.set(true);
        this.active.update(i => Math.min(i + 1, this.results().length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.active.update(i => Math.max(i - 1, 0));
        break;
      case 'Enter':
        if (this.open() && this.active() >= 0) {
          e.preventDefault();
          this.select(this.results()[this.active()]);
        }
        break;
      case 'Escape':
        this.open.set(false);
        break;
    }
  }
}
