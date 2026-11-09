import { Component, computed, inject, input, model, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ProductsService } from '../../services/products.service';
import { Brand, CompatModel, ProductModel } from '../../types/product.types';
import { catchError, combineLatest, debounceTime, distinctUntilChanged, of, startWith, switchMap, tap } from 'rxjs';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-model-picker',
  styleUrl: './model-picker.css',
  templateUrl: './model-picker.html',
})
export class ModelPicker {
  private readonly service = inject(ProductsService);

  readonly brands = input.required<Brand[]>();
  readonly single = input(false); // equipo completo: un solo modelo
  readonly selected = model<CompatModel[]>([]);

  readonly brandId = signal<number | null>(null);
  readonly brandName = computed(() => this.brands().find(b => b.id === this.brandId())?.name ?? '');
  readonly search = new FormControl('', { nonNullable: true });
  readonly results = signal<ProductModel[]>([]);
  readonly loading = signal(false);

  constructor() {
    combineLatest([
      toObservable(this.brandId),
      this.search.valueChanges.pipe(startWith(''), debounceTime(300), distinctUntilChanged()),
    ])
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(([id, q]) =>
          id === null
            ? of([] as ProductModel[])
            : this.service.getModels(id, q.trim() || undefined).pipe(catchError(() => of([] as ProductModel[]))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe(list => {
        this.results.set(list);
        this.loading.set(false);
      });
  }

  onBrand(value: string) {
    this.search.setValue('', { emitEvent: false });
    this.brandId.set(value ? Number(value) : null);
  }

  isSelected(id: number) {
    return this.selected().some(s => s.id === id);
  }

  toggle(m: ProductModel) {
    if (this.isSelected(m.id)) return this.remove(m.id);
    const item: CompatModel = { ...m, brandId: this.brandId()!, brandName: this.brandName() };
    this.selected.set(this.single() ? [item] : [...this.selected(), item]);
  }

  remove(id: number) {
    this.selected.set(this.selected().filter(s => s.id !== id));
  }
}
