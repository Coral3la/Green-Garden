import { fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { AppComponent } from './app.component';
import { authInterceptor } from './interceptors/auth.interceptor';

const TOKEN_KEY = 'green-garden.token';

describe('AppComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    localStorage.removeItem(TOKEN_KEY);
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        // Mirrors app.config.ts — without the interceptor a 401 would never
        // clear the session, and these specs would be testing a different app.
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.removeItem(TOKEN_KEY);
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have the 'Green-Garden' title`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('Green-Garden');
  });

  it('keeps sign out reachable when the profile request fails', fakeAsync(() => {
    // Seed the token before the component is built, so AuthService restores it.
    localStorage.setItem(TOKEN_KEY, 'stored-token');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();

    // AuthService defers the profile fetch by a microtask to dodge NG0200, so
    // the request does not exist yet on the synchronous path — let it settle.
    flushMicrotasks();

    // A non-401 failure leaves us holding a token but never a profile. The 401
    // case is the interceptor's to handle, and it logs us out instead.
    httpMock
      .expectOne((req) => req.url.endsWith('/auth/me'))
      .flush('boom', { status: 500, statusText: 'Server Error' });
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.hero__signout'))
      .withContext('sign out must not depend on the profile loading')
      .toBeTruthy();
    expect(compiled.textContent).not.toContain('Signed in as');

    // Drain the plant load the now-vetted session kicked off.
    httpMock.match(() => true).forEach((req) => req.flush([]));
  }));

  it('holds the garden back until a stored token has been vetted', fakeAsync(() => {
    localStorage.setItem(TOKEN_KEY, 'stored-token');
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    flushMicrotasks();
    fixture.detectChanges();

    const profile = httpMock.expectOne((req) => req.url.endsWith('/auth/me'));
    const compiled = fixture.nativeElement as HTMLElement;

    // Mid-restore we hold a token but do not yet know it is any good, so we
    // commit to neither view.
    expect(compiled.querySelector('main'))
      .withContext('the garden must not render on an unvetted token')
      .toBeNull();
    expect(compiled.querySelector('app-auth-form'))
      .withContext('nor should the login form flash before we know')
      .toBeNull();
    expect(httpMock.match((req) => req.url.endsWith('/plants')).length)
      .withContext('no plant load should race /auth/me')
      .toBe(0);

    // The token turns out to be expired: the interceptor clears the session
    // and we land on the login form, having never shown the garden.
    profile.flush('expired', { status: 401, statusText: 'Unauthorized' });
    fixture.detectChanges();

    expect(compiled.querySelector('main')).toBeNull();
    expect(compiled.querySelector('app-auth-form')).toBeTruthy();
  }));

  it('should render the hero title', () => {
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    // Normalize the &nbsp; in "Green Garden" to a regular space before asserting.
    const heading = compiled
      .querySelector('h1')
      ?.textContent?.replace(/\s+/g, ' ')
      .trim();
    expect(heading).toContain('Green Garden');
  });
});
