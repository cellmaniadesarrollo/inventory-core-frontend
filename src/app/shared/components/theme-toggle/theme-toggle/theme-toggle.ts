import { Component, inject } from '@angular/core';
import { ThemeService } from '../../../../core/services/theme.service';

@Component({
  imports: [],
  selector: 'app-theme-toggle',
  styleUrl: './theme-toggle.css',
  templateUrl: './theme-toggle.html',
})
export class ThemeToggle {
  themeService = inject(ThemeService);
}
