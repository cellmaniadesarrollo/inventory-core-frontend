import { Component, ElementRef, forwardRef, ViewChild, AfterViewInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es.js';

@Component({
  selector: 'app-date-range-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-range-picker.html',
  styleUrl: './date-range-picker.css',
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateRangePicker),
      multi: true
    }
  ]
})
export class DateRangePicker implements ControlValueAccessor, AfterViewInit, OnDestroy {
  @Input() placeholder: string = 'Seleccionar rango de fechas';
  @ViewChild('dateInput') dateInput!: ElementRef<HTMLInputElement>;

  // Emisor opcional por si prefieres EventEmitter en lugar de formularios reactivos
  @Output() dateRangeChange = new EventEmitter<{ dateFrom: string, dateTo: string }>();

  private fp: any;
  private onChange = (val: any) => { };
  private onTouched = () => { };

  ngAfterViewInit() {
    this.fp = flatpickr(this.dateInput.nativeElement, {
      mode: 'range',
      dateFormat: 'Y-m-d',
      locale: Spanish,
      onChange: (selectedDates) => {
        if (selectedDates.length === 2) {
          const dateFrom = this.formatDate(selectedDates[0]);
          const dateTo = this.formatDate(selectedDates[1]);

          // Notifica a Reactive Forms
          const val = { dateFrom, dateTo };
          this.onChange(val);
          this.onTouched();

          // Emite también el objeto plano por si se usa directamente
          this.dateRangeChange.emit(val);
        } else if (selectedDates.length === 0) {
          this.onChange(null);
          this.onTouched();
          this.dateRangeChange.emit({ dateFrom: '', dateTo: '' });
        }
      }
    });
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  writeValue(value: any): void {
    if (value && this.fp) {
      this.fp.setDate(value, false);
    } else if (this.fp) {
      this.fp.clear();
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  ngOnDestroy() {
    if (this.fp) {
      this.fp.destroy();
    }
  }
}