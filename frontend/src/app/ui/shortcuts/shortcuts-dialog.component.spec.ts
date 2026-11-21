import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ShortcutsDialogComponent } from './shortcuts-dialog.component';

describe('ShortcutsDialogComponent', () => {
  let fixture: ComponentFixture<ShortcutsDialogComponent>;
  let host: HTMLElement;

  const isOpen = () => host.matches(':popover-open');

  beforeEach(() => {
    fixture = TestBed.createComponent(ShortcutsDialogComponent);
    host = fixture.nativeElement as HTMLElement;
    document.body.appendChild(host);
    fixture.detectChanges();
  });

  afterEach(() => {
    if (isOpen()) host.hidePopover();
    host.remove();
  });

  it('is a dialog named by its title', () => {
    const titleId = host.getAttribute('aria-labelledby') ?? '';

    expect(host.getAttribute('role')).toBe('dialog');
    expect(host.querySelector(`#${titleId}`)?.textContent).toBe('Keyboard shortcuts');
  });

  it('starts closed and hidden', () => {
    expect(host.hasAttribute('popover')).toBeTrue();
    expect(isOpen()).toBeFalse();
    expect(getComputedStyle(host).display).toBe('none');
  });

  it('opens and closes on toggle', () => {
    fixture.componentInstance.toggle();
    expect(isOpen()).toBeTrue();

    fixture.componentInstance.toggle();
    expect(isOpen()).toBeFalse();
  });

  it('pairs every shortcut with what it does', () => {
    const rows = Array.from(host.querySelectorAll('dl > div'));

    expect(rows.length).toBe(8);
    for (const row of rows) {
      expect(row.querySelectorAll('dt kbd').length).toBeGreaterThan(0);
      expect(row.querySelector('dd')?.textContent?.trim()).toBeTruthy();
    }
  });
});
