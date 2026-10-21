import { Routes } from '@angular/router';
import { LetterListComponent } from './letters/letter-list.component';
import { ReviewComponent } from './review/review.component';

export const routes: Routes = [
  { path: '', component: LetterListComponent },
  { path: 'letters/:id', component: ReviewComponent },
  { path: '**', redirectTo: '' },
];
