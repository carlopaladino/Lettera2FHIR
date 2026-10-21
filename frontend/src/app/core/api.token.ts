import { InjectionToken } from '@angular/core';
import { ApiService } from './api.models';

export const REVIEW_API = new InjectionToken<ApiService>('REVIEW_API');
