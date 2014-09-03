/**
 * @ngdoc directive
 * @name ui.router.state.diretive.ui-view
 *
 * @requires ui.router.state.$state
 * @requires $compile
 * @requires $controller
 * @requires $injector
 *
 * @restrict ECA
 *
 * @description
 * The ui-view directive tells $state where to place your templates.
 * A view can be unnamed or named.
 *
 * @param {string} ui-view A view name.
 */
$ViewDirective.$inject = ['$state', '$compile', '$controller', '$injector', '$uiViewScroll', '$document'];
function $ViewDirective(   $state,   $compile,   $controller,   $injector,   $uiViewScroll,   $document) {

  function getService() {
    return ($injector.has) ? function(service) {
      return $injector.has(service) ? $injector.get(service) : null;
    } : function(service) {
      try {
        return $injector.get(service);
      } catch (e) {
        return null;
      }
    };
  }

  var viewIsUpdating = false,
      service = getService(),
      $animator = service('$animator'),
      $animate = service('$animate');

  // Returns a set of DOM manipulation functions based on whether animation
  // should be performed
  function getRenderer(element, attrs, scope) {
    var statics = function() {
      return {
        leave: function (element) { element.remove(); },
        enter: function (element, parent, anchor) { anchor.after(element); }
      };
    };

    if ($animate) {
      return function(shouldAnimate) {
        return !shouldAnimate ? statics() : {
          enter: function(element, parent, anchor) { $animate.enter(element, null, anchor); },
          leave: function(element) { $animate.leave(element, function() { element.remove(); }); }
        };
      };
    }

    if ($animator) {
      var animate = $animator && $animator(scope, attrs);

      return function(shouldAnimate) {
        return !shouldAnimate ? statics() : {
          enter: function(element, parent, anchor) { animate.enter(element, parent); },
          leave: function(element) { animate.leave(element.contents(), element); }
        };
      };
    }

    return statics;
  }

  var directive = {
    restrict: 'ECA',
    controller: ['$scope', '$element', '$attrs', function($scope, element, attrs) {
      var isDefault = true,
          parentEl  = element.parent();

      this.initial = undefined;
      this.anchor = undefined;

      var _cleanupLastView = function() {
        if (currentEl) {
          renderer(true).leave(currentEl);
          currentEl = null;
        }

        if (currentScope) {
          currentScope.$destroy();
          currentScope = null;
        }
      };

      var inherited = parentEl.inheritedData('$uiView');

      var currentScope, currentEl, viewLocals,
          name      = attrs[directive.name] || attrs.name || '',
          onloadExp = attrs.onload || '',
          autoscrollExp = attrs.autoscroll,
          renderer  = getRenderer(element, attrs, $scope);

      if (name.indexOf('@') < 0) {
        name = name + '@' + (inherited ? inherited.state.name : ''); 
      }

      var view = { 
        'name': name, 
        'state': null 
      };

      this.updateView = function(shouldAnimate, force) {
        var locals = $state.$current && $state.$current.locals[name];

        if (isDefault) {
          isDefault = false;
          element.replaceWith(this.anchor);
        }

        if (!locals) {
          _cleanupLastView();
          currentEl = element.clone();
          currentEl.html(this.initial);
          renderer(shouldAnimate).enter(currentEl, parentEl, this.anchor);

          currentScope = $scope.$new();
          $compile(currentEl.contents())(currentScope);
          return;
        }

        if (!force && locals === viewLocals) return; // nothing to do

        _cleanupLastView();

        currentEl = element.clone();
        currentEl.html(locals.$template ? locals.$template : this.initial);
        renderer(true).enter(currentEl, parentEl, this.anchor);

        currentEl.data('$uiView', view);

        viewLocals = locals;
        view.state = locals.$$state;

        var link = $compile(currentEl.contents());

        currentScope = $scope.$new();

        if (locals.$$controller) {
          locals.$scope = currentScope;
          var controller = $controller(locals.$$controller, locals);
          currentEl.children().data('$ngControllerController', controller);
        }

        link(currentScope);

        currentScope.$emit('$viewContentLoaded');
        if (onloadExp) currentScope.$eval(onloadExp);

        if (!angular.isDefined(autoscrollExp) || !autoscrollExp || $scope.$eval(autoscrollExp)) {
          $uiViewScroll(currentEl);
        }
      };

    }],
    compile: function (element) {
      var initial   = element.html(),
          anchor    = angular.element($document[0].createComment(' ui-view-anchor '));

      element.prepend(anchor);

      return function ($scope, element, attrs, ctrl) {

        ctrl.initial = initial;
        ctrl.anchor = anchor;

        var eventHook = function () {
          if (viewIsUpdating) return;
          viewIsUpdating = true;

          try { ctrl.updateView(true); } catch (e) {
            viewIsUpdating = false;
            throw e;
          }
          viewIsUpdating = false;
        };

        $scope.$on('$stateChangeSuccess', eventHook);
        $scope.$on('$viewContentLoading', eventHook);

        ctrl.updateView(false);
      };
    }
  };

  return directive;
}

angular.module('ui.router.state').directive('uiView', $ViewDirective);
