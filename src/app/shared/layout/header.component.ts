import { Component, OnInit } from '@angular/core';
import { Location } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { PhaseService, Phase } from '../../core/services/phase.service';
import { UserService } from '../../core/services/user.service';
import { Router, RoutesRecognized } from '@angular/router';
import { filter, pairwise } from 'rxjs/operators';
import { GithubEventService } from '../../core/services/githubevent.service';
import { ErrorHandlingService } from '../../core/services/error-handling.service';
import { IssueService } from '../../core/services/issue.service';
import { shell } from 'electron';
import { GithubService } from '../../core/services/github.service';

@Component({
  selector: 'app-layout-header',
  templateUrl: './header.component.html'
})
export class HeaderComponent implements OnInit {
  private prevUrl;
  isReloadBtnDisabled = false;
  FILTER_START = '?q=is:issue+is:open+'; // the filtered list must be an issue and must be open
  TUTORIAL_LABEL = '+label:tutorial.';
  TEAM_LABEL = '+label:team.';
  EXCLUDE_DUPLICATE = '+-label:duplicate'; // exclude duplicate issues

  constructor(private router: Router, public auth: AuthService, public phaseService: PhaseService, public userService: UserService,
              private location: Location, private githubService: GithubService, private issueService: IssueService,
              private githubEventService: GithubEventService, private errorHandlingService: ErrorHandlingService) {
    router.events.pipe(
      filter((e: any) => e instanceof RoutesRecognized),
      pairwise()
    ).subscribe(e => {
      this.prevUrl = e[0].urlAfterRedirects;
    });
  }

  ngOnInit() {}

  needToShowBackButton(): boolean {
    return `/${this.phaseService.currentPhase}` !== this.router.url && this.router.url !== '/';
  }

  needToShowReloadButton(): boolean {
    return this.router.url !== '/phase1/issues/new';
  }

  goBack() {
    if (this.prevUrl === `/${this.phaseService.currentPhase}/issues/new`) {
      this.router.navigate(['/phase1']);
    } else {
      this.location.back();
    }
  }

  viewBrowser() {
    const routerUrl = this.router.url.substring(1); // remove the first '/' from string
    const issueUrlIndex = routerUrl.indexOf('/'); // find the index of second '/'
    let issueUrl: string;

    // If can't find the index of second '/', then router is at the /issues (table list) page
    if (issueUrlIndex < 0) {
      // Apply filters to the issueUrl
      issueUrl = '/issues'.concat(this.getSearchFilterString()).concat(this.getTeamFilterString());
    } else {
      // issueUrl will be from the second '/'
      issueUrl = routerUrl.substring(issueUrlIndex);
    }
    shell.openExternal('https://github.com/'.concat(this.githubService.getRepoURL()).concat(issueUrl));
  }

  private getSearchFilterString() {
    return this.FILTER_START.concat(this.issueService.getIssueSearchFilter());
  }

  private getTeamFilterString() {

    // First Phase does not need team filtering
    if (this.phaseService.currentPhase === Phase.phase1) {
      return '';
    }

    // Initialise the team filter for Students in other Phases
    if (this.userService.currentUser.team) {
      this.issueService.setIssueTeamFilter(this.userService.currentUser.team.id); // e.g W12-3
    }

    let teamFilterString = '';
    let teamFilter: string[];

    // If there is team filter (e.g Currently viewing team W12-3)
    if (this.issueService.getIssueTeamFilter() !== 'All Teams') {
      teamFilter = this.issueService.getIssueTeamFilter().split('-'); // e.g W12-3 -> W12 and 3

      // E.g "+label:tutorial.W12+label:team.3"
      teamFilterString = this.TUTORIAL_LABEL.concat(teamFilter[0]).concat(this.TEAM_LABEL).concat(teamFilter[1]);
      // Only include duplicate Issue in last Phase
      return (this.phaseService.currentPhase === Phase.phase3) ? teamFilterString : this.EXCLUDE_DUPLICATE.concat(teamFilterString);
    }
    /* TODO
    // For viewing All Teams assigned to tutor
    this.userService.currentUser.allocatedTeams.forEach((team) => {
      teamFilter = team.id.split('-'); // e.g W12-4 -> W12 and 4
      teamFilterString = teamFilterString.concat(this.TUTORIAL_LABEL).concat(teamFilter[0]).concat(this.TEAM_LABEL).concat(teamFilter[1]);
    }); */

    // Only include duplicate Issue in last Phase
    return (this.phaseService.currentPhase === Phase.phase3) ? teamFilterString : this.EXCLUDE_DUPLICATE.concat(teamFilterString);
  }

  reload() {
    this.isReloadBtnDisabled = true;

    this.githubEventService.reloadPage().subscribe(
      (success) => success,
      (error) => {
        this.errorHandlingService.handleHttpError(error, () => this.githubEventService.reloadPage());
      });

    // Prevent user from spamming the reload button
    setTimeout(() => {
      this.isReloadBtnDisabled = false;
    },
    3000);
  }

  logOut() {
    this.auth.logOut();
  }
}
