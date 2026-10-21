import { Provider } from '@angular/core';
import { REVIEW_API } from './api.token';
import { HttpApiService } from './http-api.service';
import { MockApiService } from './mock-api.service';
import { environment } from '../../environments/environment';

export const reviewApiProvider: Provider = {
  provide: REVIEW_API,
  useFactory: (mock: MockApiService, http: HttpApiService) =>
    environment.useMock ? mock : http,
  deps: [MockApiService, HttpApiService],
};
