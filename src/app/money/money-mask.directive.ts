import { Directive, ElementRef, forwardRef, HostListener, Injector, Input, OnInit, Renderer2 } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, NgControl } from '@angular/forms';

const CURRENCY_DIRECTIVE_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => MoneyMaskDirective),
  multi: true
};

@Directive({
  selector: '[sfkMoneyMask]',
  providers: [ CURRENCY_DIRECTIVE_VALUE_ACCESSOR ]
})
export class MoneyMaskDirective implements ControlValueAccessor, OnInit {
  @Input() delimiter = ' ';

  @Input() numeralDecimalMark = ',';

  @Input() numeralPositiveOnly = false;

  @Input() stripLeadingZeroes = true;

  @Input() decimalZeroes = true;

  @Input() numeralDecimalScale = 2;

  @Input() numeralIntegerScale = 15;

  private ngControl: NgControl;

  private onChange: (value: string) => void;

  private onTouch: () => void;

  private keyboardEvent: KeyboardEvent;

  constructor(private injector: Injector, private renderer: Renderer2, private elementRef: ElementRef) {
  }

  @HostListener('blur')
  onBlur() {
    if (this.decimalZeroes) {
      this.addDecimalZeroes();
    }
    this.onTouch();
  }

  @HostListener('input')
  onInput() {
    const value = this.getNativeValue();
    const selectionStart = this.elementRef.nativeElement.selectionStart;
    const formattedValue = this.formatCurrencyValue(value);

    this.onChange(formattedValue);
    this.setNativeValue(formattedValue);

    this.fixCursorPosition(value, selectionStart);
  }

  @HostListener('keydown', [ '$event' ])
  keyDownEvent(event: KeyboardEvent) {
    if (event.key && event.key.length === 1 && !event.key.match(/[,.\d]/) && !event.ctrlKey) {
      event.preventDefault();
    }
    this.keyboardEvent = event;

    this.togglePositiveNegative();
  }

  ngOnInit(): void {
    this.ngControl = this.injector.get(NgControl);
    this.renderer.setAttribute(this.elementRef.nativeElement, 'type', 'text');
    this.renderer.addClass(this.elementRef.nativeElement, 'text-end');
  }

  private formatCurrencyValue(value: any): string {
    value = this.getNormalizedValue(value);
    value = this.getStripLeadingZeros(value);

    const partSign = this.getPartSign(value);
    let partInteger = value;
    let partDecimal = '';

    if (value.indexOf(this.numeralDecimalMark) >= 0) {
      const parts = value.split(this.numeralDecimalMark);
      partInteger = parts[0];
      partDecimal = parts[1];
      partDecimal = this.trimDecimalScale(partDecimal);
    }

    partInteger = this.getIntegerWithoutSign(partSign, partInteger);
    partInteger = this.trimIntegerScale(partInteger);
    partInteger = this.addLeadingZero(partInteger, partDecimal);
    partInteger = this.addDelimiter(partInteger);

    return partSign + partInteger.toString() + this.getDecimalIsScale(partDecimal);
  }

  private getStripLeadingZeros(value: any) {
    if (this.stripLeadingZeroes) {
      value = value.replace(/^(-)?0+(?=\d)/, '$1');
    }
    return value;
  }

  private getPartSign(value: any) {
    return value.slice(0, 1) === '-' ? '-' : '';
  }

  private trimDecimalScale(partDecimal: string) {
    return this.numeralDecimalMark + partDecimal.slice(0, this.numeralDecimalScale);
  }

  private getIntegerWithoutSign(partSign: string, partInteger) {
    return (partSign === '-') ? partInteger.slice(1) : partInteger;
  }

  private trimIntegerScale(partInteger) {
    if (this.numeralIntegerScale > 0) {
      partInteger = partInteger.slice(0, this.numeralIntegerScale);
    }
    return partInteger;
  }

  private getDecimalIsScale(partDecimal: string) {
    return this.numeralDecimalScale > 0 ? partDecimal.toString() : '';
  }

  private addDelimiter(partInteger) {
    return partInteger.replace(/(\d)(?=(\d{3})+$)/g, '$1' + this.delimiter);
  }

  private addLeadingZero(partInteger, partDecimal: string) {
    return (partInteger === '' && partDecimal !== '') ? '0' : partInteger;
  }

  private getNormalizedValue(value: any) {
    if (value?.indexOf('-') > 0) {
      value = '-' + value.replaceAll('-', '');
    }
    return (value || '').replace(/[A-Za-z]/g, '')
      .replace(/[,.]/, 'M')
      .replace(/[^\dM-]/g, '')
      .replace(/^-/, 'N')
      .replace(/-/g, '')
      .replace('N', this.numeralPositiveOnly ? '' : '-')
      .replace('M', this.numeralDecimalMark);
  }

  private getRawValue(value: string): number | null {
    const allDelimiter = new RegExp(this.delimiter, 'g');
    return (value !== '')
      ? parseFloat(value.replace(allDelimiter, '').replace(this.numeralDecimalMark, '.'))
      : null;
  }

  private addDecimalZeroes() {
    const value = this.getNativeValue();
    if (value !== '') {
      const parts = value.split(this.numeralDecimalMark);
      const partInteger = parts[0] === '-' ? '0' : parts[0];
      let partDecimal = parts[1] ? parts[1] + '00' : '00';
      partDecimal = this.numeralDecimalMark + partDecimal.slice(0, this.numeralDecimalScale);

      const formattedValue = partInteger + partDecimal;
      this.onChange(formattedValue);
      this.setNativeValue(formattedValue);
    }
  }

  private togglePositiveNegative() {
    const value = this.getNativeValue();
    if (!this.numeralPositiveOnly && this.keyboardEvent?.key === '-') {
      const partSign = this.getPartSign(value);
      let newPositionStart = this.elementRef.nativeElement.selectionStart;

      const formattedValue = partSign ? value.replace('-', '') : '-' + value;

      newPositionStart = partSign ? newPositionStart - 1 : newPositionStart + 1;

      this.onChange(formattedValue);
      this.setNativeValue(formattedValue);
      this.setSelection(newPositionStart);
    }
  }

  private fixCursorPosition(valueBeforeFormat: string, initPosition: number) {
    const newValue = this.getNativeValue();
    const diffDelimiter = newValue.split(this.delimiter).length - valueBeforeFormat.split(this.delimiter).length;
    const diffLength = newValue.length - valueBeforeFormat.length;
    const isNewValueIsDelimiter = newValue[initPosition] === this.delimiter;
    const isDecimalMarkPressed = this.keyboardEvent && this.keyboardEvent
      .key?.match(`[.${ this.numeralDecimalMark }]`)?.length > 0;
    const isBackspaceDelimiter = this.keyboardEvent && this.keyboardEvent.key === 'Backspace'
      && isNewValueIsDelimiter;
    const isDelete = diffDelimiter < 0 && this.keyboardEvent && this.keyboardEvent.key === 'Delete';
    const indexShift = this.getPartSign(newValue) ? 1 : 0;
    const isChangeLeadingZero = valueBeforeFormat[indexShift] === '0' && newValue[indexShift] !== '0';

    let newPositionStart = isBackspaceDelimiter ? initPosition
      : isDecimalMarkPressed ? newValue.indexOf(this.numeralDecimalMark) + 1
        : isDelete || isChangeLeadingZero ? initPosition - 1
          : diffLength < 0 ? initPosition + (isNewValueIsDelimiter ? 1 : diffDelimiter)
            : initPosition + diffLength;

    this.setSelection(newPositionStart);
  }

  private setSelection(positionStart: number, positionEnd?: number): void {
    positionStart = positionStart >= 0 ? positionStart : 0;
    positionEnd = positionEnd ?? positionStart;
    this.elementRef.nativeElement.setSelectionRange(positionStart, positionEnd);
  }

  private getNativeValue() {
    return this.elementRef.nativeElement.value;
  }

  private setNativeValue(formattedValue: string) {
    this.renderer.setProperty(this.elementRef.nativeElement, 'value', formattedValue);
  }

  registerOnChange(fn: (value: number) => void): void {
    this.onChange = (value: string) => {
      const valueToEmit = value === '' ? null : this.getRawValue(value);
      fn(valueToEmit);
    };
  }

  registerOnTouched(callbackFunction: () => void): void {
    this.onTouch = callbackFunction;
  }

  setDisabledState(isDisabled: boolean): void {
    this.renderer.setProperty(this.elementRef.nativeElement, 'disabled', isDisabled);
  }

  writeValue(value: number): void {
    const formattedValue = this.formatCurrencyValue(value?.toString());
    this.setNativeValue(formattedValue);
    if (this.decimalZeroes) {
      this.addDecimalZeroes();
    }
  }
}
